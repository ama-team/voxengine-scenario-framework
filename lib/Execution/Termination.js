var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException
var Status = require('../Schema').OperationStatus
var Errors = require('../Error')

/**
 * Helper class that exists only to wrap scenario termination.
 *
 * @param {IExecutor} executor
 * @param {TTerminationHandler} handler
 * @param {LoggerOptions} [options]
 *
 * @class
 */
function Termination (executor, handler, options) {
  var logger = Slf4j.factory(options, 'ama-team.vsf.execution.termination')

  /**
   * @param {TTerminationHandler} handler
   * @param {TScenarioResult} result
   * @param {TimeoutException} [error]
   *
   * @return {Thenable.<TTerminationResult|Error>}
   */
  function runHandler (handler, result, error) {
    try {
      logger.debug('Running {} termination handler', handler.id)
      var promise = executor.promise(handler.handler, [result, error])
      logger.trace('Scheduling {} termination handler timeout in {} ms',
        handler.id, handler.timeout)
      return timeout(promise, handler.timeout, callbackFactory(handler, result))
    } catch (e) {
      var message = 'Unexpected error during termination handler execution'
      return Promise.reject(new Errors.UnexpectedError(message, e))
    }
  }

  /**
   * Generates callback for handler timeout
   *
   * @param {TTerminationHandler} handler
   * @param {TScenarioResult} result
   * @return {timeout~onTimeout}
   */
  function callbackFactory (handler, result) {
    return function (resolve, reject) {
      logger.warn('{} termination handler has exceeded timeout of {} ms',
        handler.id, handler.timeout)
      // TODO: leave error generation for SDK as soon as it is ready
      var message = handler.id + ' handler has exceeded timeout of ' +
        handler.timeout + ' ms'
      var error = new TimeoutException(message)
      if (!handler.timeoutHandler) {
        return reject(error)
      }
      logger.info('Running {} timeout rescue handler', handler.id)
      runHandler(handler.timeoutHandler, result, error)
        // passing reject directly *may* result in unhandled rejection
        .then(resolve, function (e) { reject(e) })
    }
  }

  /**
   * @param {TScenarioResult} result
   *
   * @return {Thenable.<TTerminationResult>}
   */
  this.run = function (result) {
    logger.info('Running termination sequence')
    return runHandler(handler, result)
      .then(function (value) {
        logger.info('Termination sequence has successfully completed')
        return {value: value, status: Status.Finished}
      }, function (e) {
        logger.info('Termination sequence has failed with error {}', e, e)
        var internal = e instanceof Errors.InternalError
        var status = internal ? Status.Tripped : Status.Failed
        return {value: e, status: status}
      })
  }
}

module.exports = {
  Termination: Termination
}
