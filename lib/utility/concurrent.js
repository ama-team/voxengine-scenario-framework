function TimeoutException(message) {
    this.name = 'TimeoutException';
    this.message = message;
}

/**
 * @callback timeout.onTimeout
 *
 * @param {function} onFulfilled
 * @param {function} onRejected
 */

/**
 * Wraps promise in another one that guarantees that execution will take no longer than X.
 *
 * @param {Promise} promise Promise to wrap
 * @param {number} milliseconds Timeout value
 * @param {timeout.onTimeout} [onTimeout] Handler to run when timeout is reached
 */
function timeout(promise, milliseconds, onTimeout) {
    onTimeout = onTimeout instanceof Function ? onTimeout : function (resolve, reject) {
        var message = 'Promise has not completed in requested time (' + milliseconds + ' milliseconds)';
        reject(new TimeoutException(message));
    };
    return new Promise(function (resolve, reject) {
        promise.then(resolve, reject);
        setTimeout(function () {
            try {
                onTimeout.call(this, resolve, reject);
            } catch (e) {
                reject(e);
            }
        }, milliseconds);
    })
}

var PASS_THROUGH = function (v) { return v; };
var THROW = function (e) { throw e; };

function ControlledPromise(handler) {
    var resolveCallback,
        rejectCallback,
        finished = false,
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
        return new ControlledPromise(function(resolve, reject) {
            identity
                .then(onFulfilled, onRejected)
                .then(resolve, reject);
        });
    };
}

ControlledPromise.prototype.resolve = function (value) {
    if (value instanceof ControlledPromise) {
        return value;
    }
    return new ControlledPromise(function (resolve, reject) {
        resolve(value);
    });
};

ControlledPromise.prototype.reject = function (value) {
    if (value instanceof ControlledPromise) {
        return value;
    }
    return new ControlledPromise(function (resolve, reject) {
        reject(value);
    });
};

ControlledPromise.prototype.all = function (iterable) {
    return new ControlledPromise(function (resolve, reject) {
        Promise.all(iterable).then(resolve, reject);
    });
};

ControlledPromise.prototype.race = function (iterable) {
    return new ControlledPromise(function (resolve, reject) {
        Promise.race(iterable).then(resolve, reject);
    });
};

exports = module.exports = {
    timeout: timeout,
    ControlledPromise: ControlledPromise,
    TimeoutException: TimeoutException
};