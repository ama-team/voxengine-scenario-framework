var concurrent = require('../utility/concurrent'),
    CompletablePromise = concurrent.CompletablePromise,
    CancellationToken = concurrent.CancellationToken,
    TimeoutException = concurrent.TimeoutException;
    /**
     * @enum
     * @readonly
     */
    var MachineState = {
        Idle: 'Idle',
        Transition: 'Transition',
        Terminating: 'Terminating',
        Terminated: 'Terminated'
    };
    /**
     * @enum
     * @readonly
     */
    var MachineTerminationCause = {
        Success: 'Success',
        TransitionFail: 'TransitionFail',
        TransitionTimeout: 'TransitionTimeout',
        StateTimeout: 'StateTimeout',
        UnexpectedException: 'UnexpectedException'
    };
    /**
     * @enum
     * @readonly
     */
    var TransitionState = {
        Idle: 'Idle',
        Running: 'Running',
        Completed: 'Completed',
        Aborted: 'Aborted',
        Failed: 'Failed',
        TimedOut: 'TimedOut',
        /**
         * Means there was an exception framework responsible for
         */
        Exploded: 'Exploded'
    };

/**
 * Wraps promise in timeout if passed amount of milliseconds is > 0
 *
 * @param {Promise} promise
 * @param {number} milliseconds
 * @param {function} [onTimeout]
 * @return {Promise}
 */
function timeout(promise, milliseconds, onTimeout) {
    return milliseconds && milliseconds > 0 ? concurrent.timeout(promise, milliseconds, onTimeout) : promise;
}

/**
 * Exception that will be used to reject transition promise in case things go south.
 *
 * @class
 *
 * @param status
 * @param error
 * @param message
 * @constructor
 */
function TransitionExecutionException(status, message, error) {
    this.message = message || 'Unexpected exception during transition execution';
    this.status = status;
    this.error = error;
    this.stack = (new Error()).stack + (error ? '\n' + error.name + ' ' + error.stack : '');
}
TransitionExecutionException.prototype = Object.create(Error.prototype);
TransitionExecutionException.prototype.name = 'TransitionExecutionException';
TransitionExecutionException.prototype.constructor = TransitionExecutionException;

/**
 * @class
 *
 * @param {StateDeclaration} origin
 * @param {StateDeclaration} target
 * @param {object} hints
 * @param {ExecutionRuntime} runtime
 * @param {Slf4jAlikeLogger} logger
 */
function Transition(origin, target, hints, runtime, logger) {

    var state = TransitionState.Idle,
        completion = new CompletablePromise(),
        cancellation = new CancellationToken();

    this.origin = origin;
    this.target = target;
    this.hints = hints;
    this.cancellation = cancellation;

    /**
     * Executes user-defined handler.
     *
     * @param {function} handler
     * @return {Promise.<Directive|Error|object>}
     */
    function executeHandler(handler) {
        var parameters = Array.prototype.slice.call(arguments, 0);
        return handler.apply(runtime, parameters);
    }

    function convertException(e) {
        var message;
        if (e instanceof TransitionExecutionException) {
            return e;
        }
        if (e instanceof TimeoutException) {
            message = toString() + ' has timed out';
            return new TransitionExecutionException(TransitionState.TimedOut, message, e);
        }
        message = toString() + ' has failed during execution';
        return new TransitionExecutionException(TransitionState.Failed, message, e);
    }

    function runRescueHandler(error) {
        var token = new CancellationToken(cancellation),
            future = executeHandler(target.onTransitionTimeout, origin, hints, token, error);
        return timeout(future, target.timeouts.onTransitionTimeout, function (res, rej, e) {
            logger.error('{} rescue handler has exceeded timeout of {} ms', toString(),
                target.timeouts.onTransitionTimeout);
            rej(e);
        });
    }

    function run() {
        var message;
        if (state !== TransitionState.Idle) {
            message = toString() + ' run attempt has been made while in state ' + state;
            return Promise.reject(new TransitionExecutionException(TransitionState.Exploded, message))
        }
        try {
            logger.info('Running {}', toString());
            var token = new CancellationToken(cancellation),
                future = executeHandler(target.transition, origin, hints, token);
            future = timeout(future, target.timeouts.transition, function (res, rej, e) {
                token.cancel();
                logger.warn(toString() + ' has exceeded timeout of {} ms, launching rescue handler',
                    target.timeouts.transition);
                runRescueHandler(e).then(res, rej);
            });
            future.then(function (v) {
                if (cancellation.isCancelled() || state !== TransitionState.Running) {
                    return;
                }
                logger.debug('{} has completed successfully', toString());
                state = TransitionState.Completed;
                completion.resolve(v);
            }, function (e) {
                if (cancellation.isCancelled() || state !== TransitionState.Running) {
                    return;
                }
                logger.error('{} has completed exceptionally: {}', toString(), e);
                state = e instanceof TimeoutException ? TransitionState.TimedOut : TransitionState.Failed;
                completion.reject(convertException(e));
            });
        } catch (e) {
            state = TransitionState.Exploded;
            message = 'Unexpected exception ' + e.toString() + ' occurred during ' + toString() + ' run';
            completion.reject(new TransitionExecutionException(TransitionState.Exploded, message, e));
        }
        return completion;
    }

    function abort() {
        var message;
        if (state !== TransitionState.Running) {
            message = toString() + ' abort attempt has been made while in state ' + state;
            return Promise.reject(new TransitionExecutionException(TransitionState.Exploded, message));
        }
        try {
            cancellation.cancel();
            logger.info('Running {} abort process', toString());
            var token = new CancellationToken(),
                future = executeHandler(target.abort, origin, hints, token);
            future = timeout(future, target.timeouts.abort, function (res, rej, e) {
                token.cancel();
                logger.warn('{} abort process has exceeded timeout of {} ms, running rescue handler', toString(),
                    target.timeouts.abort);
                runAbortRescueHandler(e).then(res, rej);
            });
            return future
                .then(function (v) {
                    logger.info('{} abort process has finished successfully', toString());
                    state = TransitionState.Aborted;
                    completion.resolve(v);
                }, function (e) {
                    logger.error('{} abort process has finished with exception: {}', toString(), e);
                    state = e instanceof TimeoutException ? TransitionState.TimedOut : TransitionState.Failed;
                    completion.reject(convertException(e));
                });
        } catch (e) {
            state = TransitionState.Exploded;
            message = 'Got unexpected exception during ' + toString() + ' abort: ' + e.toString();
            completion.reject(new TransitionExecutionException(state, message, e));
        }
        return completion;
    }

    function runAbortRescueHandler(error) {
        var token = new CancellationToken(),
            future = executeHandler(target.onAbortTimeout, origin, hints, token, error);
        return timeout(future, target.timeouts.onAbortTimeout)
            .then(function (v) {
                logger.debug('{} abort rescue handler has successfully resolved', toString());
                return v;
            }, function (e) {
                logger.error('{} abort rescue handler has finished with exception {}', toString(), e);
                throw e;
            });
    }

    function toString() {
        return 'Transition ' + origin.id + ' -> ' + target.id;
    }

    //noinspection JSUnusedGlobalSymbols
    this.run = run;
    //noinspection JSUnusedGlobalSymbols
    this.abort = abort;
    //noinspection JSUnusedGlobalSymbols
    this.getState = function () { return state; };
    this.toString = toString;
}

/**
 * @class
 * @param {string} id Missing state id
 */
function MissingStateException(id) {
    this.state = id;
    this.message = 'State ' + id + ' could not be found';
}

MissingStateException.prototype = Object.create(Error.prototype);
MissingStateException.prototype.name = 'MissingStateException';
MissingStateException.prototype.constructor = MissingStateException;

/**
 * @class
 *
 * @param {MachineTerminationCause} cause
 * @param {Error|undefined|null} [error]
 * @param {string|undefined|null} [message]
 */
function MachineTerminationException(cause, message, error) {
    //noinspection JSUnusedGlobalSymbols
    this.cause = cause;
    this.message = message || 'State machine has terminated abnormal due to ' + cause;
    this.stack = (new Error()).stack + (error ? '\n\n' + error.name + ' ' + error.stack : '');
}
MachineTerminationException.prototype = Object.create(Error.prototype);
MachineTerminationException.prototype.name = 'MachineTerminationException';
MachineTerminationException.prototype.constructor = MachineTerminationException;

/**
 * This class executes user-defined transitions and is not a finite state machine. It's just a state machine.
 *
 * @class
 *
 * @param {StateDeclaration[]} states
 * @param {ExecutionRuntime} runtime
 * @param {Slf4jAlikeLogger} logger
 * @constructor
 */
function StateMachine(states, runtime, logger) {

    var state = MachineState.Idle,
        scenarioState,
        scenarioStateTimeout,
        running,
        history = [],
        completion = new CompletablePromise(),
        transitions = [];

    function getState(id) {
        return states.reduce(function (v, s) { return v || s.id !== id ? v : s }, null);
    }

    function requireState(id) {
        var s = getState(id);
        if (!s) { throw new MissingStateException(id); }
        return s;
    }

    function setState(id) {
        var s = scenarioState = requireState(id);
        if (scenarioStateTimeout) { scenarioStateTimeout.resolve(); }
        scenarioStateTimeout = new CompletablePromise();
        timeout(scenarioStateTimeout, s.timeouts.state, function (res, rej, e) {
            completion.reject(new MachineTerminationException(MachineTerminationCause.StateTimeout, e));
            res();
        });
    }

    function transitionTo(id, hints) {
        if (state === MachineState.Transition) { abortRunningTransition(); }
        if (state !== MachineState.Idle) { throw new Error('Invalid machine state: ' + state); }
        var transition = running = new Transition(scenarioState, requireState(id), hints, runtime, logger);
        transitions.push(transition);
        state = MachineState.Transition;
        return running.run()
            .then(function (v) {
                return handleResolve(transition, v);
            }, function (e) {
                return handleReject(transition, e);
            });
    }

    function abortRunningTransition() {
        if (state !== MachineState.Transition) {
            logger.warn('abortRunningTransition() called with no running transition');
            return Promise.resolve({});
        }
        state = MachineState.Idle;
        return running.abort();
    }

    function handleResolve(transition, v) {
        // todo
        throw new Error('Not implemented');
    }

    function handleReject(transition, e) {
        // todo
        throw new Error('Not implemented');
    }

    function handleFinished(transition) {
        transitions = transitions.filter(function (t) { return t !== transition; });
        if (running === transition) { running = null; }
    }

    this.transitionTo = transitionTo;
    //noinspection JSUnusedGlobalSymbols
    this.abortRunningTransition = abortRunningTransition;
    //noinspection JSUnusedGlobalSymbols
    this.getRunningTransition = function () { return running; };
    //noinspection JSUnusedGlobalSymbols
    this.getCompletion = function () { return completion; };
    //noinspection JSUnusedGlobalSymbols
    this.getHistory = function () { return history; }
}

exports = module.exports = {
    Transition: Transition,
    TransitionState: TransitionState,
    TransitionExecutionException: TransitionExecutionException,
    StateMachine: StateMachine,
    MachineState: MachineState,
    MissingStateException: MissingStateException,
    MachineTerminationCause: MachineTerminationCause,
    MachineTerminationException: MachineTerminationException
};