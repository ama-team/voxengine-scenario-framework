function TimeoutException(message) {
    this.name = 'TimeoutException';
    this.message = message;
    this.stack = (new Error()).stack;
}

TimeoutException.prototype = Object.create(Error.prototype);
//noinspection JSUnusedGlobalSymbols
TimeoutException.prototype.constructor = TimeoutException;

function CancellationToken() {
    var cancelled = false,
        promise = new CompletablePromise();

    this.isCancelled = function () {
        return cancelled;
    };

    this.getPromise = function () {
        return promise;
    };

    this.cancel = function () {
        cancelled = true;
        promise.resolve();
    }
}

/**
 * @callback timeout.onTimeout
 *
 * @param {function} onFulfilled
 * @param {function} onRejected
 * @param {TimeoutException} error
 */

/**
 * Wraps promise in another one that guarantees that execution will take no longer than X.
 *
 * @param {Promise} promise Promise to wrap
 * @param {number} milliseconds Timeout value
 * @param {timeout.onTimeout} [onTimeout] Handler to run when timeout is reached
 */
function timeout(promise, milliseconds, onTimeout) {
    var timeout;
    onTimeout = onTimeout instanceof Function ? onTimeout : function (resolve, reject, error) {
        reject(error);
    };
    return new Promise(function (resolve, reject) {
        timeout = setTimeout(function () {
            try {
                var message = 'Promise has not completed in requested time (' + milliseconds + ' milliseconds)';
                onTimeout.call(this, resolve, reject, new TimeoutException(message));
            } catch (e) {
                reject(e);
            }
        }, milliseconds);
        promise.then(function (v) {
            clearTimeout(timeout);
            resolve(v);
        }, function (e) {
            clearTimeout(timeout);
            reject(e);
        });
    })
}

var PASS_THROUGH = function (v) { return v; };
var THROW = function (e) { throw e; };

function CompletablePromise(handler) {
    var finished = false,
        self = this,
        identity = new Promise(function (resolve, reject) {
            self.resolve = function (value) {
                finished = true;
                resolve(value);
            };
            self.reject = function (value) {
                finished = true;
                reject(value);
            };

            if (handler) {
                handler(self.resolve, self.reject, function () {
                    return !finished;
                });
            }
        });

    this.then = function (onFulfilled, onRejected) {
        if (!(onFulfilled instanceof Function)) {
            onFulfilled = PASS_THROUGH;
        }
        if (!(onRejected instanceof Function)) {
            onRejected = THROW;
        }
        return new CompletablePromise(function(resolve, reject) {
            identity
                .then(onFulfilled, onRejected)
                .then(resolve, reject);
        });
    };
}

CompletablePromise.prototype.resolve = function (value) {
    if (value instanceof CompletablePromise) {
        return value;
    }
    return new CompletablePromise(function (resolve) {
        resolve(value);
    });
};

CompletablePromise.prototype.reject = function (value) {
    if (value instanceof CompletablePromise) {
        return value;
    }
    return new CompletablePromise(function (resolve, reject) {
        reject(value);
    });
};

CompletablePromise.prototype.all = function (iterable) {
    return new CompletablePromise(function (resolve, reject) {
        Promise.all(iterable).then(resolve, reject);
    });
};

CompletablePromise.prototype.race = function (iterable) {
    return new CompletablePromise(function (resolve, reject) {
        Promise.race(iterable).then(resolve, reject);
    });
};

exports = module.exports = {
    timeout: timeout,
    CompletablePromise: CompletablePromise,
    TimeoutException: TimeoutException,
    CancellationToken: CancellationToken
};