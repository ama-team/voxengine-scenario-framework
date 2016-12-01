var concurrent = require('../utility/concurrent'),
    timeout = concurrent.safeTimeout,
    CompletablePromise = concurrent.CompletablePromise,
    CancellationToken = concurrent.CancellationToken,
    TimeoutException = concurrent.TimeoutException,
    schema = require('../schema/definitions'),
    TerminationCause = schema.TerminationCause,
    TransitionResult = schema.TransitionResult;

/**
 * @enum
 * @readonly
 */
var TransitionState = {
    Idle: 'Idle',
    Running: 'Running',
    Completed: 'Completed',
    Aborting: 'Aborting',
    Aborted: 'Aborted',
    Failed: 'Failed',
    TimedOut: 'TimedOut',
    /**
     * Means there was an exception framework responsible for
     */
    Exploded: 'Exploded'
};

/**
 * @class
 *
 * @param {State} origin
 * @param {State} target
 * @param {object} hints
 * @param {ExecutionRuntime} runtime
 * @param {RichLoggerInterface} logger
 */
function Transition(origin, target, hints, runtime, logger) {

    var state = TransitionState.Idle,
        completion = new CompletablePromise(),
        cancellation = new CancellationToken();

    origin = origin || {id: null};

    //noinspection JSUnusedGlobalSymbols
    this.origin = origin;
    this.target = target;
    this.hints = hints;
    //noinspection JSUnusedGlobalSymbols
    this.cancellation = cancellation;

    /**
     * Runs transition timeout rescue handler
     *
     * @param error
     * @return {Promise}
     */
    function runRescueHandler(error) {
        var token = new CancellationToken(cancellation),
            future = runtime.execute(target.onTransitionTimeout, origin, hints, token, error);
        future = timeout(future, target.timeouts.onTransitionTimeout, function (res, rej, e) {
            logger.error('{} rescue handler has exceeded timeout of {} ms', toString(),
                target.timeouts.onTransitionTimeout);
            rej(e);
        });
        return future
            .then(function (v) {
                logger.debug('{} rescue handler has successfully resolved', toString());
                return v;
            }, function (e) {
                logger.error('{} rescue handler has finished with exception, propagating', toString());
                throw e;
            });
    }

    /**
     * @return {Promise} Promise that will be resolved once transition has completed.
     */
    function run() {
        var message;
        if (state !== TransitionState.Idle) {
            message = toString() + ' run attempt has been made while in state ' + state;
            return Promise.reject(new TransitionExecutionException(TransitionState.Exploded, message))
        }
        try {
            logger.debug('Running {}', toString());
            state = TransitionState.Running;
            var token = new CancellationToken(cancellation),
                future = runtime.executeAsPromise(target.transition, origin, hints, token);
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
                completion.resolve(new TransitionResult(TerminationCause.Completion, v));
            }, function (e) {
                if (cancellation.isCancelled() || state !== TransitionState.Running) {
                    return;
                }
                logger.error('{} has completed with exception {}', toString(), e.name);
                var timedOut = e instanceof TimeoutException,
                    cause = timedOut ? TerminationCause.TransitionTimeout : TerminationCause.TransitionFailure;
                state = timedOut ? TransitionState.TimedOut : TransitionState.Failed;
                completion.resolve(new TransitionResult(cause, null, e));
            });
        } catch (e) {
            state = TransitionState.Exploded;
            logger.error('{} has failed with unexpected exception {}', toString(), e.name);
            completion.resolve(new TransitionResult(TerminationCause.FrameworkFailure, null, e));
        }
        return completion;
    }

    /**
     * Aborts transition
     *
     * @return {Promise} Promise that will be resolved once transition is fully completed
     */
    function abort() {
        var message;
        if (state !== TransitionState.Running) {
            message = toString() + ' abort attempt has been made while in state ' + state;
            return Promise.reject(new TransitionExecutionException(TransitionState.Exploded, message));
        }
        try {
            cancellation.cancel();
            logger.debug('Running {} abort process', toString());
            var token = new CancellationToken(),
                future = runtime.execute(target.abort, origin, hints, token);
            future = timeout(future, target.timeouts.abort, function (res, rej, e) {
                token.cancel();
                logger.warn('{} abort process has exceeded timeout of {} ms, running rescue handler', toString(),
                    target.timeouts.abort);
                runAbortRescueHandler(e).then(res, rej);
            });
            future
                .then(function (v) {
                    logger.debug('{} abort process has finished successfully', toString());
                    state = TransitionState.Aborted;
                    completion.resolve(new TransitionResult(TerminationCause.Abortion, v));
                }, function (e) {
                    logger.error('{} abort process has finished with exception {}', toString(), e.name);
                    var timedOut = e instanceof TimeoutException,
                        cause = timedOut ? TerminationCause.AbortTimeout : TerminationCause.AbortFailure;
                    state = timedOut ? TransitionState.TimedOut : TransitionState.Failed;
                    completion.resolve(new TransitionResult(cause, null, e));
                });
        } catch (e) {
            state = TransitionState.Exploded;
            completion.resolve(new TransitionResult(TerminationCause.FrameworkFailure, null, e));
        }
        return completion;
    }

    function runAbortRescueHandler(error) {
        var token = new CancellationToken(),
            future = runtime.execute(target.onAbortTimeout, origin, hints, token, error);
        future = timeout(future, target.timeouts.onAbortTimeout, function (res, rej, e) {
            logger.error('{} abort rescue handler has exceeded timeout of {} ms', toString(),
                target.timeouts.onAbortTimeout);
            rej(e);
        });
        return future
            .then(function (v) {
                logger.debug('{} abort rescue handler has successfully resolved', toString());
                return v;
            }, function (e) {
                logger.error('{} abort rescue handler has finished with exception {}, propagating', toString(), e.name);
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

exports = module.exports = {
    Transition: Transition,
    TransitionState: TransitionState
};