var concurrent = require('../utility/concurrent'),
    CompletablePromise = concurrent.CompletablePromise,
    TimeoutException = concurrent.TimeoutException,
    timeout = concurrent.safeTimeout,
    transitions = require('./transition'),
    Transition = transitions.Transition,
    TransitionState = transitions.TransitionState;

/**
 * @enum
 * @readonly
 */
var MachineState = {
    Idle: 'Idle',
    Transitioning: 'Transitioning',
    Terminated: 'Terminated',
    Terminating: 'Terminating'
};
/**
 * @enum
 * @readonly
 */
var MachineTerminationCause = {
    Completion: 'Completion',
    TransitionFailure: 'TransitionFailure',
    TransitionTimeout: 'TransitionTimeout',
    StateTimeout: 'StateTimeout',
    UnexpectedException: 'UnexpectedException',
    IllegalFrameworkUsage: 'InvalidUsage',
    FrameworkFailure: 'FrameworkFailure'
};

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

function MachineTerminationResult(cause, error, state) {
    this.cause = cause;
    this.error = error;
    this.state = state;
}

/**
 * This class executes user-defined transitions and is not a finite state machine. It's just a state machine.
 *
 * It operates under following circumstances:
 *
 * - Only one active transition may be present. If second transition is launched during first one, the first one is
 * aborted and put up into 'waiting' queue so termination sequence may wait for it to finish. Aborted transitions don't
 * affect outcome.
 * - Once state with terminal flag set is reached, machine successfully terminates
 * - If transition fails or times out, machine terminates with an exception
 * - If state timeout is reached, and rescue handler doesn't save the situation, machine terminates with an exception
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
        active,
        history = [],
        completion = new CompletablePromise(),
        termination = completion.then(terminate, terminate),
        transitions = [],
        entrypoint = states.reduce(function (c, s) { return s.entrypoint ? s: c; }, null);

    runtime.transitionTo = transitionTo;

    // region state management

    /**
     * Finds state with given id
     *
     * @param {string} id
     *
     * @return {StateDeclaration|null}
     */
    function getState(id) {
        return states.reduce(function (v, s) { return v || s.id !== id ? v : s }, null);
    }

    /**
     * Finds state with given id or throws an error
     *
     * @param id
     *
     * @return {StateDeclaration}
     */
    function requireState(id) {
        var s = getState(id);
        if (!s) { throw new Error('State ' + id + ' is not registered'); }
        return s;
    }

    /**
     * Sets current state to one passed as argument
     *
     * @param {string} id
     */
    function setState(id) {
        var s = scenarioState = requireState(id);
        if (scenarioStateTimeout) {
            logger.debug('Clearing previous state timeout');
            scenarioStateTimeout.resolve();
        }
        if (s.timeouts.state > 0) {
            logger.debug('Setting timeout for state {} ({} ms)', s.id, s.timeouts.state);
            scenarioStateTimeout = new CompletablePromise();
            timeout(scenarioStateTimeout, s.timeouts.state, function (res, rej, e) {
                logger.debug('State {} has reached it\'s timeout of {} ms, terminating', s.id, s.timeouts.state);
                completion.reject(new MachineTerminationException(MachineTerminationCause.StateTimeout, e));
                res();
            });
        }
    }

    // endregion

    // region transition registry

    function registerTransition(transition) {
        transitions.push(transition);
        return transition;
    }

    function deregisterTransition(transition) {
        transitions = transitions.filter(function (t) { return t !== transition });
        return transition;
    }

    // endregion

    // region transaction processing

    /**
     * Performs transition to state with selected id.
     *
     * @param {string} id ID of state to transition to.
     * @param {object} hints User-defined hints for transition.
     * @return {Promise}
     */
    function transitionTo(id, hints) {
        try {
            hints = hints || {};
            logger.debug('Running transition to state {} with hints {}', id, hints);
            if (state === MachineState.Transitioning) {
                logger.debug('Found already active transition, aborting it');
                abortRunningTransition();
            }
            if (state !== MachineState.Idle) {
                throw new Error('Invalid machine state: ' + state);
            }
            var transition = active = new Transition(scenarioState, requireState(id), hints, runtime, logger);
            registerTransition(transition);
            state = MachineState.Transitioning;
            return active.run()
                .then(function (v) {
                    logger.debug('{} has finished successfully', transition.toString());
                    return handleTransitionResolve(transition, v);
                }, function (e) {
                    logger.debug('{} has finished with error {}', transition.toString(), e.name);
                    return handleTransitionReject(transition, e);
                });
        } catch (e) {
            var message = 'Unexpected exception occurred';
            completion.reject(new MachineTerminationException(MachineTerminationCause.UnexpectedException, message, e));
            return completion;
        }
    }

    /**
     * Processes transition resolution result.
     *
     * @param {Transition} transition
     * @param {Directive} directive
     *
     * @return {Promise.<Directive>} Normalized directive
     */
    function handleTransitionResolve(transition, directive) {
        deregisterTransition(transition);
        if (transition === active) {
            return handleActiveTransitionResolve(transition, directive);
        }
        return handleAsideTransitionResolve(transition, directive);
    }

    /**
     * Performs logic for transition reject
     *
     * @param {Transition} transition
     * @param {Error} error
     */
    function handleTransitionReject(transition, error) {
        deregisterTransition(transition);
        if (transition === active) {
            return handleActiveTransitionReject(transition, error);
        }
        return handleAsideTransitionReject(transition, error);
    }

    function handleActiveTransitionResolve(transition, directive) {
        state = MachineState.Idle;
        var target = directive.transitionedTo ? directive.transitionedTo : transition.target.id;
        logger.debug('{} has reached state {}', transition.toString(), target);
        setState(target);
        if (scenarioState.terminal) {
            logger.info('Reached state {} is terminal, halting', scenarioState.id);
            completion.resolve(scenarioState);
            return directive;
        }
        if (directive.trigger && directive.trigger.id) {
            logger.info('{} triggers next transition to state {}', transition.toString(), scenarioState.trigger.id);
            transitionTo(scenarioState.trigger.id, scenarioState.trigger.hints);
        }
        return directive;
    }

    function handleActiveTransitionReject(transition, error) {
        state = MachineState.Idle;
        var cause = MachineTerminationCause.TransitionFail,
            message = transition.toString() + 'has failed';
        if (error instanceof TimeoutException) {
            cause = MachineTerminationCause.TransitionTimeout;
            message = transition.toString() + 'has timed out';
        }
        completion.reject(new MachineTerminationException(cause, message, error));
    }

    function handleAsideTransitionResolve(transition, directive) {
        logger.info('{} has completed in aside-mode, ignoring it', transition.toString());
        return directive;
    }

    function handleAsideTransitionReject(transition, error) {
        logger.warn('{} has rejected in aside-mode, ignoring it:', transition.toString(), error);
        return error;
    }

    // endregion

    /**
     * Aborts currently running transition.
     *
     * @return {Promise} promise that will resolve/reject once transition has completely finished.
     */
    function abortRunningTransition() {
        if (state !== MachineState.Transitioning) {
            logger.warn('abortRunningTransition() called with no running transition');
            return Promise.resolve({});
        }
        logger.debug('Aborting active transition {}', active.toString());
        state = MachineState.Idle;
        return active.abort();
    }

    /**
     * Runs termination chores
     *
     * @return {Promise}
     */
    function terminate() {
        logger.debug('Terminating state machine');
        state = MachineState.Terminating;
        if (active && active.getState() === TransitionState.Running) {
            active.abort();
            active = null;
        }
        logger.debug('Waiting for {} transitions to finish');
        return Promise.all(transitions).then(function () {
            state = MachineState.Terminated;
            return completion;
        });
    }

    function run(hints) {
        transitionTo(entrypoint.id, hints || {});
        return termination;
    }

    this.run = run;

    this.transitionTo = transitionTo;
    //noinspection JSUnusedGlobalSymbols
    this.abortRunningTransition = abortRunningTransition;
    //noinspection JSUnusedGlobalSymbols
    this.getRunningTransition = function () { return active; };
    //noinspection JSUnusedGlobalSymbols
    this.getCompletion = function () { return termination; };
    //noinspection JSUnusedGlobalSymbols
    this.getHistory = function () { return history; };

    this.getState = function () { return state; };
}

exports = module.exports = {
    StateMachine: StateMachine,
    MachineState: MachineState,
    MachineTerminationCause: MachineTerminationCause,
    MachineTerminationException: MachineTerminationException,
    MachineTerminationResult: MachineTerminationResult
};