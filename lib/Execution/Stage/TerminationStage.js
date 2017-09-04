var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
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
   * @param {TInitializationStageResult} initResult
   * @param {TScenarioStageResult} scenarioResult
   *
   * @return {Thenable.<TTerminationResult>}
   */
  this.run = function (initResult, scenarioResult) {
    logger.info('Running termination sequence')
    result.startedAt = new Date()
    return executor.runHandler(handler, [initResult, scenarioResult])
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
