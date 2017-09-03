var Status = require('../Schema').OperationStatus
var Initialization = require('./Stage/InitializationStage').InitializationStage
var ScenarioStage = require('./Stage/ScenarioStage').ScenarioStage
var Termination = require('./Stage/TerminationStage').TerminationStage
var Context = require('./Context').Context
var Executor = require('./Executor').Executor
var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var Future = SDK.Concurrent.Future

/**
 * Scenario consists of three states: initialization (setup), execution and
 * termination (tear down). This class simply wraps them in a single unit of
 * execution, allowing to run whole scenario (nearly) at once.
 *
 * @param {TScenario} scenario
 * @param {TArgumentHandler} deserializer
 * @param {TRunOptions} [options]
 *
 * @class
 */
function Run (scenario, deserializer, options) {
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.execution.run')
  var context = new Context(this, options)
  var executor = new Executor(context)
  var initialization = new Initialization(executor, deserializer)
  var execution = new ScenarioStage(executor, scenario, options)
  var termination = new Termination(executor, scenario.onTermination, options)
  var stageResults = {
    initialization: null,
    scenario: null,
    termination: null
  }
  var result = {
    stages: stageResults,
    startedAt: null,
    finishedAt: null,
    status: null,
    error: null
  }
  var completion = new Future()

  /**
   * Starts run. Run performs some initialization and then stops until scenario
   * trigger is passed to #run() method
   *
   * @return {Thenable.<TRunResult>}
   */
  this.initialize = function () {
    result.startedAt = new Date()
    logger.info('Running initialization stage')
    initialization
      .initialize()
      .then(function (value) {
        logger.info('Finished initialization stage')
        stageResults.initialization = value
        logger.info('Running execution stage')
        return value.status.successful ? execution.run() : null
      })
      .then(function (value) {
        logger.info('Finished execution stage')
        stageResults.scenario = value
        logger.info('Running termination stage')
        return termination.run(stageResults.initialization, value)
      })
      .then(function (value) {
        logger.info('Finished termination stage')
        stageResults.termination = value
      })
      .then(function () {
        logger.info('Finished run')
        var weights = [Status.Finished, Status.Failed, Status.Tripped]
        result.status = Object.keys(stageResults).reduce(function (carrier, key) {
          var item = stageResults[key] && stageResults[key].status
          var weight = weights.indexOf(item)
          return weight > weights.indexOf(carrier) ? item : carrier
        }, Status.Finished)
      }, function (reason) {
        logger.info('Run has finished with unexpected error: {}', reason)
        result.status = Status.Tripped
        result.error = reason
      })
      .then(function () {
        result.finishedAt = new Date()
        result.duration = result.finishedAt.getTime() - result.startedAt.getTime()
        completion.resolve(result)
      })
    return completion
  }

  /**
   * @param {string} url
   */
  this.setLog = function (url) {
    initialization.setLog(url)
  }

  /**
   * @param {TScenarioTrigger} value
   *
   * @return {Thenable.<TRunResult>}
   */
  this.proceed = function (value) {
    initialization.proceed(value)
    return completion
  }

  /**
   * @param {TScenarioTrigger} trigger
   * @param {string} [log]
   *
   * @return {Thenable.<TRunResult>}
   */
  this.execute = function (trigger, log) {
    this.initialize()
    this.setLog(log)
    return this.proceed(trigger)
  }

  /**
   * @return {TScenario}
   */
  this.getScenario = function () {
    return scenario
  }

  this.transitionTo = function (id, hints) {
    return execution.getStateMachine().transitionTo(id, hints)
  }

  this.getCompletion = function () {
    return completion
  }

  this.getExecutor = function () {
    return executor
  }
}

module.exports = {
  Run: Run
}
