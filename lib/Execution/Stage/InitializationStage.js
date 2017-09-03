var Future = require('@ama-team/voxengine-sdk').Concurrent.Future
var Status = require('../../Schema').OperationStatus
var Objects = require('../../Utility').Objects

/**
 * This class represents scenario initialization stage (fact gathering). It is
 * executed in two steps, first being just preparation and already-known fact
 * setup, while second is consists of reacting on VoxEngine trigger event.
 *
 * @param {IExecutor} executor
 * @param {TArgumentHandler} deserializer
 * @class
 */
function InitializationStage (executor, deserializer) {
  var completion = new Future()
  var result = {
    status: null,
    error: null,
    log: null,
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
    result.log = value
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
        result.status = Status.Finished
      }, function (e) {
        result.error = e
        result.status = Status.Failed
      })
      .then(null, function (e) {
        result.error = e
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
