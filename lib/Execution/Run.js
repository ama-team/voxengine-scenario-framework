var Status = require('../Schema').OperationStatus
var Initialization = require('./Initialization').Initialization
var Termination = require('./Termination').Termination
var Execution = require('./Execution').Execution
var Context = require('./Context').Context
var Executor = require('./Executor').Executor
var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j

/**
 * @param {TScenario} scenario
 * @param {FEnvironmentDeserializer} deserializer
 * @param {TRunOptions} options
 *
 * @class
 */
function Run (scenario, deserializer, options) {
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.execution.run')
  var context = new Context(this, options)
  var executor = new Executor(context)
  var initialization = new Initialization(executor, deserializer, options)
  var execution = new Execution(executor, scenario, options)
  var termination = new Termination(executor, scenario.onTermination, options)
  var stages = {
    initialization: null,
    scenario: null,
    termination: null
  }
  var result = {
    results: stages,
    startedAt: null,
    finishedAt: null,
    status: null,
    error: null
  }

  /**
   * Starts run. Run performs some initialization and then stops until scenario
   * trigger is passed to #proceed() method
   */
  this.start = function () {
    result.startedAt = new Date()
    var results = {
      initialization: null,
      scenario: null,
      termination: null
    }
    logger.info('Running initialization stage')
    return initialization
      .start()
      .then(function (value) {
        logger.info('Finished initialization stage')
        stages.initialization = value
        logger.info('Running execution stage')
        return value.status.successful ? execution.run(value) : null
      })
      .then(function (value) {
        logger.info('Finished execution stage')
        stages.scenario = value
        logger.info('Running termination stage')
        return value ? termination.run(value) : null
      })
      .then(function (value) {
        logger.info('Finished termination stage')
        stages.termination = value
      })
      .then(function () {
        logger.info('Finished run')
        var weights = [Status.Finished, Status.Failed, Status.Tripped]
        result.status = Object.keys(stages).reduce(function (carrier, key) {
          var item = stages[key] && stages[key].status
          var weight = weights.indexOf(item)
          return weight > weights.indexOf(carrier) ? item : carrier
        }, Status.Finished)
      }, function (reason) {
        logger.info('Run has finished with unexpected error: {}', reason)
        result.status = Status.Tripped
        result.error = reason
      })
      .then(function () {
        result.results = results
        result.finishedAt = new Date()
        result.duration = result.finishedAt.getTime() - result.startedAt.getTime()
        return result
      })
  }

  this.setLogUrl = function (value) {
    initialization.setLogUrl(value)
  }

  /**
   * @param {TScenarioTrigger} value
   */
  this.proceed = function (value) {
    initialization.trigger(value)
    return this
  }
}

module.exports = {
  Run: Run
}
