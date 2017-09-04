var SDK = require('@ama-team/voxengine-sdk')
var Future = SDK.Concurrent.Future
var Status = require('../../Schema').OperationStatus
var Objects = require('../../Utility').Objects
var Slf4j = SDK.Logger.Slf4j

/**
 * This class represents scenario initialization stage (fact gathering). It is
 * executed in two steps, first being just preparation and already-known fact
 * setup, while second is consists of reacting on VoxEngine trigger event.
 *
 * @param {IExecutor} executor
 * @param {TArgumentHandler} deserializer
 * @param {object} [options]
 * @class
 */
function InitializationStage (executor, deserializer, options) {
  options = options || {}
  var loggerName = 'ama-team.vsf.execution.stage.initialization-stage'
  var logger = Slf4j.factory(options.logger, loggerName)
  var completion = new Future()
  var result = {
    status: null,
    value: null,
    startedAt: null,
    finishedAt: null,
    duration: null
  }

  this.initialize = function () {
    result.startedAt = new Date()
    return completion
  }

  /**
   * @param {string} value
   */
  this.setLog = function (value) {
    executor.getContext().log = value
  }

  /**
   * @param {TScenarioTrigger} trigger
   * @return {TInitializationStageResult}
   */
  this.proceed = function (trigger) {
    var ctx = executor.getContext()
    ctx.trigger = trigger
    executor
      .runHandler(deserializer, [trigger.arguments, trigger])
      .then(function (value) {
        ctx.arguments = Objects.merge(ctx.arguments, value, true)
        logger.info('Merged context arguments:', ctx.arguments)
        logger.debug('Context state:', ctx.state)
        result.status = Status.Finished
      }, function (e) {
        result.value = e
        result.status = Status.Failed
      })
      .then(null, function (e) {
        result.value = e
        result.status = Status.Tripped
      })
      .then(function () {
        result.finishedAt = new Date()
        result.duration = result.finishedAt.getTime() - result.startedAt.getTime()
        completion.resolve(result)
      })
    return completion
  }
}

module.exports = {
  InitializationStage: InitializationStage
}
