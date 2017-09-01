var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException
var Status = require('../../Schema/index').OperationStatus
var Errors = require('../../Error/index')

/**
 * Helper class that exists only to wrap scenario termination.
 *
 * @param {IExecutor} executor
 * @param {TTerminationHandler} handler
 * @param {TTerminationOptions} [options]
 *
 * @class
 */
function Termination (executor, handler, options) {
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.execution.termination')

  /**
   * @param {TTerminationHandler} handler
   * @param {TInitializationStageResult} initialization
   * @param {TScenarioStageResult} scenario
   * @param {TimeoutException} [error]
   *
   * @return {Thenable.<TTerminationResult|Error>}
   */
  function runHandler (handler, initialization, scenario, error) {
    try {
      logger.debug('Running {} termination handler', handler.id)
      var promise = executor.promise(handler.handler, [initialization, scenario, error])
      logger.trace('Scheduling {} termination handler timeout in {} ms',
        handler.id, handler.timeout)
      return timeout(promise, handler.timeout, callbackFactory(handler, initialization, scenario))
    } catch (e) {
      var message = 'Unexpected error during termination handler execution'
      return Promise.reject(new Errors.UnexpectedError(message, e))
    }
  }

  /**
   * Generates callback for handler timeout
   *
   * @param {TTerminationHandler} handler
   * @param {TInitializationStageResult} initialization
   * @param {TScenarioStageResult} scenario
   * @return {timeout~onTimeout}
   */
  function callbackFactory (handler, initialization, scenario) {
    return function (resolve, reject) {
      logger.warn('{} termination handler has exceeded timeout of {} ms',
        handler.id, handler.timeout)
      // TODO: leave error generation for SDK as soon as it is ready
      var message = handler.id + ' handler has exceeded timeout of ' +
        handler.timeout + ' ms'
      var error = new TimeoutException(message)
      if (!handler.onTimeout) {
        return reject(error)
      }
      logger.info('Running {} timeout rescue handler', handler.id)
      runHandler(handler.onTimeout, initialization, scenario, error)
        // passing reject directly *may* result in unhandled rejection
        .then(resolve, function (e) { reject(e) })
    }
  }

  /**
   * @param {TInitializationStageResult} initialization
   * @param {TScenarioStageResult} scenario
   *
   * @return {Thenable.<TTerminationResult>}
   */
  this.run = function (initialization, scenario) {
    logger.info('Running termination sequence')
    return runHandler(handler, initialization, scenario)
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
