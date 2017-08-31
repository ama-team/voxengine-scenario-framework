var Future = require('@ama-team/voxengine-sdk').Concurrent.Future
var Status = require('../Schema').OperationStatus

/**
 * @param {FEnvironmentDeserializer} deserializer
 * @class
 */
function InitializationStage (deserializer) {
  var startedAt
  var finishedAt
  /**
   * @type {TScenarioTrigger}
   */
  var trigger
  var logUrl
  var completion = new Future()

  this.start = function () {
    startedAt = new Date()
    return completion
  }

  /**
   * @param {TScenarioTrigger} value
   */
  this.proceed = function (value) {
    trigger = value
    return completion
  }
  /**
   * @param {string} value
   */
  this.setLogUrl = function (value) {
    logUrl = value
  }

  this.complete = function () {
    finishedAt = new Date()
    var value
    var status
    try {
      value = {
        arguments: deserializer(trigger.arguments),
        state: {},
        trigger: trigger,
        logUrl: logUrl
      }
      status = Status.Finished
    } catch (e) {
      value = e
      status = Status.Failed
    }
    return completion.resolve({
      value: value,
      status: status,
      startedAt: startedAt,
      finishedAt: finishedAt,
      duration: finishedAt.getTime() - startedAt.getTime()
    })
  }
}

module.exports = {
  Initialization: InitializationStage
}
