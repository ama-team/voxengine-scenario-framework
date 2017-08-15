var utilities = require('./common')

function TimeoutException (message) {
  this.name = 'TimeoutException'
  this.message = message
  this.stack = (new Error()).stack
}

TimeoutException.prototype = Object.create(Error.prototype)
// noinspection JSUnusedGlobalSymbols
TimeoutException.prototype.constructor = TimeoutException

/**
 * @class
 *
 * @param {CancellationToken...} [dependencies] Optional list of tokens this token depends on, which means that if any
 *   of dependency tokens gets cancelled, this token is cancelled as well.
 */
function CancellationToken (dependencies) {
  var cancelled = false
  var c = { resolve: null }
  var promise = new Promise(function (resolve) {
    c.resolve = resolve
  })
  dependencies = Array.prototype.slice.apply(arguments)

  if (dependencies.length) {
    var promises = Array.prototype.map.call(dependencies, function (token) {
      return token.getPromise()
    })
    Promise.all(promises).then(function (v) {
      c.resolve(v)
    })
  }

  this.isCancelled = function () {
    return dependencies.filter(function (token) { return token.isCancelled() }).length > 0 || cancelled
  }

  this.getPromise = function () {
    return promise
  }

  this.cancel = function () {
    cancelled = true
    c.resolve()
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
function timeout (promise, milliseconds, onTimeout) {
  var timeout
  onTimeout = onTimeout instanceof Function ? onTimeout : function (resolve, reject, error) {
    reject(error)
  }
  return new Promise(function (resolve, reject) {
    timeout = setTimeout(function () {
      try {
        var message = 'Promise has not completed in requested time (' + milliseconds + ' milliseconds)'
        onTimeout.call(this, resolve, reject, new TimeoutException(message))
      } catch (e) {
        reject(e)
      }
    }, milliseconds)
    promise.then(function (v) {
      clearTimeout(timeout)
      resolve(v)
    }, function (e) {
      clearTimeout(timeout)
      reject(e)
    })
  })
}

/**
 * Returns timeout-wrapped promise if milliseconds is > 0, original promise otherwise
 *
 * @param {Promise} promise Promise to wrap with timeout.
 * @param {number} milliseconds Number of milliseconds to timeout after.
 * @param {timeout.onTimeout} [onTimeout] Optional handler to run on timeout.
 *
 * @return {Promise}
 */
function safeTimeout (promise, milliseconds, onTimeout) {
  return milliseconds && milliseconds > 0 ? timeout(promise, milliseconds, onTimeout) : promise
}

/**
 * @class
 * @extends Promise
 * @param {function} [handler]
 */
function CompletablePromise (handler) {
  var finished = false
  var resolvedWith
  var rejectedWith
  var self = this
  var identity = new Promise(function (resolve, reject) {
    self.resolve = function (value) {
      if (finished) {
        return false
      }
      resolve(resolvedWith = value)
      finished = true
      return true
    }
    self.reject = function (value) {
      if (finished) {
        return false
      }
      reject(rejectedWith = value)
      finished = true
      return true
    }

    if (handler) {
      handler(self.resolve, self.reject, function () {
        return !finished
      })
    }
  })

  this.toString = function () {
    var value = finished ? (resolvedWith ? resolvedWith.toString() : rejectedWith.toString()) : '{none}'
    return 'CompletablePromise [' + value + ']'
  }

  // noinspection JSUnusedGlobalSymbols
  this.hasFinished = function () {
    return finished
  }

  this.then = function (onFulfilled, onRejected) {
    if (!(onFulfilled instanceof Function)) {
      onFulfilled = utilities.functions.PassThrough
    }
    if (!(onRejected instanceof Function)) {
      onRejected = utilities.functions.ReThrow
    }
    return new CompletablePromise(function (resolve, reject) {
      identity
        .then(onFulfilled, onRejected)
        .then(resolve, reject)
    })
  }
}

CompletablePromise.prototype.resolve = function (value) {
  if (value instanceof CompletablePromise) {
    return value
  }
  return new CompletablePromise(function (resolve) {
    resolve(value)
  })
}

CompletablePromise.prototype.reject = function (value) {
  if (value instanceof CompletablePromise) {
    return value
  }
  return new CompletablePromise(function (resolve, reject) {
    reject(value)
  })
}

CompletablePromise.prototype.all = function (iterable) {
  return new CompletablePromise(function (resolve, reject) {
    Promise.all(iterable).then(resolve, reject)
  })
}

CompletablePromise.prototype.race = function (iterable) {
  return new CompletablePromise(function (resolve, reject) {
    Promise.race(iterable).then(resolve, reject)
  })
}

exports = module.exports = {
  timeout: timeout,
  safeTimeout: safeTimeout,
  CompletablePromise: CompletablePromise,
  TimeoutException: TimeoutException,
  CancellationToken: CancellationToken
}
