var concurrent = require('../utility/concurrent'),
    timeout = concurrent.safeTimeout,
    CompletablePromise = concurrent.CompletablePromise,
    CancellationToken = concurrent.CancellationToken,
    TimeoutException = concurrent.TimeoutException;

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
 * @param {RichLoggerInterface} logger
 */
function Transition(origin, target, hints, runtime, logger) {

    var state = TransitionState.Idle,
        completion = new CompletablePromise(),
        cancellation = new CancellationToken();

    origin = origin || {id: null};

    this.origin = origin;
    this.target = target;
    this.hints = hints;
    this.cancellation = cancellation;

    /**
     * Converts exception got during transition/abort process into {TransitionExecutionException}
     *
     * @param {Error|TransitionExecutionException} e Exception to convert
     * @return {TransitionExecutionException}
     */
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
                future = runtime.execute(target.transition, origin, hints, token);
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
            logger.error('{} has failed with unexpected exception', toString(), e);
            completion.reject(new TransitionExecutionException(TransitionState.Exploded, message, e));
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
                    completion.resolve(v);
                }, function (e) {
                    logger.error('{} abort process has finished with exception:', toString(), e);
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
                logger.error('{} abort rescue handler has finished with exception, propagating', toString(), e);
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
    TransitionState: TransitionState,
    TransitionExecutionException: TransitionExecutionException
};