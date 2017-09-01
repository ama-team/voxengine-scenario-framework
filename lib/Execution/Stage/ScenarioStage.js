var StateMachine = require('../StateMachine').StateMachine
var OperationStatus = require('../../Schema/index').OperationStatus

/**
 * Thin class representing scenario execution stage.
 *
 * TODO: this class probably should be merged with state machine
 *
 * @param {IExecutor} executor
 * @param {TScenario} scenario
 * @param {TScenarioStageOptions} [options]
 *
 * @class
 */
function ScenarioStage (executor, scenario, options) {
  options = options || {}
  var machine = new StateMachine(executor, scenario, options.logger)

  var result = {
    status: null,
    value: null,
    startedAt: null,
    finishedAt: null,
    duration: null
  }

  /**
   * Executes whole scenario
   *
   * @return {Thenable.<TScenarioStageResult>}
   */
  this.run = function () {
    result.startedAt = new Date()
    return machine
      .run(executor.getContext().arguments)
      .then(function (value) {
        result.status = value.status
        result.value = value.value
      }, function (e) {
        result.status = OperationStatus.Tripped
        result.value = e
      })
      .then(function () {
        result.finishedAt = new Date()
        result.duration = result.finishedAt.getTime() - result.startedAt.getTime()
        result.history = machine.getHistory()
        return result
      })
  }

  this.getStateMachine = function () {
    return machine
  }
}

module.exports = {
  ScenarioStage: ScenarioStage
}
