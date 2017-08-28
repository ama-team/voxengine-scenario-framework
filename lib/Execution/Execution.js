var Context = require('./Context').Context
var Executor = require('./Executor').Executor
var StateMachine = require('./StateMachine').StateMachine
var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException
var Termination = require('./Termination').Termination
var OperationStatus = require('../Schema').OperationStatus
var IllegalStateError = require('../Error').IllegalStateError

function statusFactory (id, successful) {
  return {
    id: id,
    terminal: typeof successful === 'boolean',
    successful: successful
  }
}

/**
 * @enum
 * @readonly
 */
var Status = {
  Idle: statusFactory('Idle'),
  Running: statusFactory('Running'),
  Terminating: statusFactory('Terminating'),
  Finished: statusFactory('Finished', true),
  Failed: statusFactory('Failed', false),
  Tripped: statusFactory('Tripped', false)
}

/**
 * @typedef {object} Execution~Options
 *
 * @property {object} [arguments]
 * @property {object} [state]
 * @property {LoggerOptions} logger
 */

/**
 * @param {TScenario} scenario
 * @param {Execution~Options} options
 *
 * @class
 *
 * @implements {IExecutionStatus}
 *
 * @property {Date|null} launchedAt
 * @property {StateMachine|null} machine
 */
function Execution (scenario, options) {
  var self = this
  var status = Status.Idle
  options = options || {}

  var ctx = new Context(self, options)
  var executor = new Executor(ctx)
  var machine = new StateMachine(executor, scenario.states, scenario.errorHandler, options.logger)
  var termination = new Termination(executor, scenario.terminationHandler, options.logger)
  var launchedAt = null
  var finishedAt = null

  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.execution.execution')

  function setStatus (next) {
    logger.debug('Changing status from {} to {}', status.id, next.id)
    status = next
  }

  /**
   * Runs scenario itself
   *
   * @return {Thenable<TScenarioResult>}
   */
  function runStates () {
    setStatus(Status.Running)
    logger.info('Running scenario states')
    var promise = machine.run(ctx.arguments)
    var wrapper = timeout(promise, scenario.timeout, function (resolve) {
      var message = 'Scenario has exceeded it\'s timeout of ' +
        scenario.timeout + ' ms'
      var error = new TimeoutException(message)
      logger.warn(message)
      machine.terminate()
      // TODO: scenario duration
      resolve({value: error, status: OperationStatus.Failed})
    })
    return wrapper
      .then(function (result) {
        logger.info('Finished running scenario states with {} status',
          result.status.id)
        return result
      })
  }

  /**
   * @param {TScenarioResult} result
   *
   * @return {Thenable.<TTerminationResult>}
   */
  function runTerminationHandler (result) {
    setStatus(Status.Terminating)
    logger.info('Running termination handlers')
    return termination
      .run(result)
      .then(function (result) {
        logger.info('Termination handlers finished with {} status',
          result.status.id)
        return result
      })
  }

  /**
   * @param {TScenarioResult} scenario
   * @param {TTerminationResult} termination
   * @return {{status: *, scenario: *, termination: *, history: Array, duration}}
   */
  function mergeResults (scenario, termination) {
    var statuses = [
      OperationStatus.Finished,
      OperationStatus.Failed,
      OperationStatus.Tripped
    ]
    var leftIndex = statuses.indexOf(scenario.status)
    var rightIndex = statuses.indexOf(termination.status)
    var index = Math.max(leftIndex, rightIndex, 0)
    return {
      status: statuses[index],
      scenario: scenario,
      termination: termination,
      history: machine.getHistory(),
      duration: self.getRunningTime()
    }
  }

  /**
   * Executes whole scenario
   *
   * @param {object} [args]
   *
   * @return {Thenable.<TExecutionResult>}
   */
  this.run = function (args) {
    if (status !== Status.Idle) {
      throw new IllegalStateError('Tried to run execution twice')
    }
    // TODO: merge (but not overwrite) args and state
    ctx.arguments = args || ctx.arguments
    launchedAt = new Date()
    var sResult = runStates()
    var tResult = sResult.then(runTerminationHandler)
    return Promise.all([sResult, tResult]).then(function (results) {
      finishedAt = new Date()
      var result = mergeResults.apply(null, results)
      setStatus(Status[result.status.id])
      return result
    })
  }

  this.getRunningTime = function () {
    var time = launchedAt ? launchedAt.getTime() : null
    var bound = finishedAt || new Date()
    return time ? (bound.getTime()) - time : null
  }

  this.getState = function () {
    var state = machine.getState()
    return state ? state.id : null
  }

  this.getTransition = function () {
    var t8n = machine.getTransition()
    return t8n ? t8n.toDetails() : null
  }
}

module.exports = {
  Execution: Execution
}
