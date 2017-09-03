var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var Future = SDK.Concurrent.Future
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException
var CancellationToken = SDK.Concurrent.CancellationToken

/**
 * @typedef {object} Branch~Options
 *
 * @property {String} name
 * @property {TStateHandler} handler
 * @property {LoggerOptions} logger
 * @property {IExecutor} executor
 */

/**
 * Represents single transition execution branch (main / abort). It's
 * entrypoint, #run() method, triggers it's execution and returns a promise
 * that either resolves with whatever handler returns or rejects with error.
 *
 * @param {Branch~Options} options
 * @class
 */
function Branch (options) {
  var result = new Future()
  var triggered = false
  var loggerName = 'ama-team.vsf.execution.transition.branch'
  var logger = Slf4j.factory(options.logger, loggerName)
  logger.attach('name', options.name)

  /**
   * @param {TStateHandler} handler
   * @param {*[]} args
   * @param {CancellationToken} token
   * @param {Function} [onTimeout]
   */
  function execute (handler, args, token, onTimeout) {
    logger.debug('Executing handler {}', handler.id)
    var promise = options.executor.promise(handler.handler, args)
    var callback = function (resolve, reject) {
      token.cancel()
      var message = 'Transition handler ' + handler.id + ' has exceeded ' +
        'it\'s timeout of ' + handler.timeout + ' ms'
      logger.warn(message)
      var error = new TimeoutException(message)
      onTimeout ? onTimeout(resolve, reject, error) : reject(error)
    }
    logger.trace('Scheduling handler {} timeout in {} ms', handler.id,
      handler.timeout)
    return timeout(promise, handler.timeout, callback)
  }

  function runHandler (handler, origin, hints, token) {
    var deps = token ? [token] : []
    var localToken = new CancellationToken(deps)
    var callback = callbackFactory(handler, origin, hints, token)
    var args = [origin, hints, localToken]
    return execute(handler, args, localToken, callback)
  }

  function callbackFactory (handler, origin, hints, token) {
    return function (resolve, reject, error) {
      if (!handler.onTimeout) {
        return reject(error)
      }
      logger.debug('Running handler {} rescue handler', handler.id)
      runHandler(handler.onTimeout, origin, hints, token)
        .then(resolve, function (e) { reject(e) })
    }
  }

  function run (origin, hints, token) {
    if (triggered) {
      var message = 'Tried to run execution branch ' + options.name + ' twice'
      throw new Error(message)
    }
    triggered = true
    logger.info('Launched')
    options.executor.runHandler(options.handler, [origin, hints], token)
      .then(function (value) {
        logger.info('Execution branch has finished with {}', value)
        result.resolve(value)
      }, function (reason) {
        logger.warn('Execution branch has failed with reason {}', reason)
        result.reject(reason)
      })
    return result
  }

  /**
   * Runs execution branch.
   *
   * @param {TState} origin
   * @param {THints} hints
   * @param {CancellationToken} [token]
   *
   * @return {Thenable}
   */
  this.run = run
}

module.exports = {
  Branch: Branch
}
