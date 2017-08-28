var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var Future = SDK.Concurrent.Future
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException
var CancellationToken = SDK.Concurrent.CancellationToken

/**
 * @enum
 * @readonly
 */
var Stage = {
  Idle: 'Idle',
  Execution: 'Execution',
  ExecutionTimeout: 'ExecutionTimeout',
  Executed: 'Executed',
  Failed: 'Failed'
}

/**
 * @typedef {object} Branch~Options
 *
 * @property {String} name
 * @property {TStateHandler} handler
 * @property {TStateHandler} timeoutHandler
 * @property {LoggerOptions} logger
 * @property {IExecutor} executor
 */

/**
 * Represents single execution branch (main / abort) of
 *
 * @param {Branch~Options} options
 * @class
 */
function Branch (options) {
  var result = new Future()
  var stage = Stage.Idle
  var loggerName = 'ama-team.vsf.execution.transition.branch'
  var logger = Slf4j.factory(options.logger, loggerName)
  logger.attach('name', options.name)

  function setStage (next) {
    logger.trace('Changing stage from {} to {}', stage, next)
    stage = next
  }

  /**
   * @param {TStateHandler} handler
   * @param {*[]} args
   * @param {CancellationToken} token
   * @param {Function} [onTimeout]
   */
  function execute (handler, args, token, onTimeout) {
    logger.debug('Executing handler {}', handler.name)
    var promise = options.executor.promise(handler.handler, args)
    var callback = function (resolve, reject) {
      token.cancel()
      var message = 'Handler ' + handler.name + ' has exceeded it\'s ' +
        'timeout of ' + handler.timeout + ' ms'
      logger.warn(message)
      var error = new TimeoutException(message)
      onTimeout ? onTimeout(resolve, reject, error) : reject(error)
    }
    logger.trace('Scheduling handler {} timeout in {} ms', handler.name,
      handler.timeout)
    return timeout(promise, handler.timeout, callback)
  }

  function runHandler (origin, hints, token) {
    var deps = token ? [token] : []
    var localToken = new CancellationToken(deps)
    var callback = function (resolve, reject, error) {
      logger.debug('Rescuing timed out {} handler', options.handler.name)
      runTimeoutHandler(origin, hints, token, error)
        .then(resolve, reject)
        // silencing unhandled rejection error
        .then(null, function () {})
    }
    var args = [origin, hints, localToken]
    setStage(Stage.Execution)
    return execute(options.handler, args, localToken, callback)
  }

  function runTimeoutHandler (origin, hints, token, error) {
    var deps = token ? [token] : []
    var localToken = new CancellationToken(deps)
    var args = [origin, hints, localToken, error]
    setStage(Stage.ExecutionTimeout)
    return execute(options.timeoutHandler, args, localToken)
  }

  function run (origin, hints, token) {
    if (stage !== Stage.Idle) {
      var message = 'Tried to run execution branch ' + options.name + ' twice'
      throw new Error(message)
    }
    logger.info('Launched')
    runHandler(origin, hints, token)
      .then(function (value) {
        logger.info('Execution branch has finished with {}', value)
        setStage(Stage.Executed)
        result.resolve(value)
      }, function (reason) {
        logger.warn('Execution branch has failed with reason {}', reason)
        setStage(Stage.Failed)
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

Branch.Stage = Stage

module.exports = {
  Branch: Branch
}
