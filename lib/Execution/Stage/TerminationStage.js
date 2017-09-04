var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException
var Status = require('../../Schema/index').OperationStatus

/**
 * Helper class that exists only to wrap scenario termination.
 *
 * @param {IExecutor} executor
 * @param {TTerminationHandler} handler
 * @param {TTerminationOptions} [options]
 *
 * @class
 */
function TerminationStage (executor, handler, options) {
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.execution.termination')
  var result = {
    status: null,
    value: null,
    startedAt: null,
    finishedAt: null,
    duration: null
  }

  /**
   * @param {TTerminationHandler} handler
   * @param {TInitializationStageResult} initResult
   * @param {TScenarioStageResult} scenarioResult
   * @param {TimeoutException} [error]
   *
   * @return {Thenable.<TTerminationResult|Error>}
   */
  function runHandler (handler, initResult, scenarioResult, error) {
    logger.debug('Running {} termination handler', handler.id)
    var args = [initResult, scenarioResult, error]
    var promise = executor.promise(handler.handler, args)
    logger.trace('Scheduling {} termination handler timeout in {} ms',
      handler.id, handler.timeout)
    var callback = callbackFactory(handler, initResult, scenarioResult)
    return timeout(promise, handler.timeout, callback)
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
        // passing reject directly may result in unhandled rejection
        .then(resolve, function (e) { reject(e) })
    }
  }

  /**
   * @param {TInitializationStageResult} initResult
   * @param {TScenarioStageResult} scenarioResult
   *
   * @return {Thenable.<TTerminationResult>}
   */
  this.run = function (initResult, scenarioResult) {
    logger.info('Running termination sequence')
    result.startedAt = new Date()
    return runHandler(handler, initResult, scenarioResult)
      .then(function (value) {
        logger.info('Termination stage has successfully completed')
        result.status = Status.Finished
        result.value = value
      }, function (e) {
        logger.info('Termination stage has failed with error {}', e, e)
        result.status = Status.Failed
        result.value = e
      })
      .then(function () {
        result.finishedAt = new Date()
        result.duration = result.finishedAt.getTime() - result.startedAt.getTime()
        return result
      })
  }
}

module.exports = {
  TerminationStage: TerminationStage
}
