var SDK = require('@ama-team/voxengine-sdk')
var Future = SDK.Concurrent.Future
var Slf4j = SDK.Logger.Slf4j
var Transition = require('./Transition').Transition
var Errors = require('../Error')
var InternalError = Errors.InternalError
var ScenarioError = Errors.ScenarioError
var Schema = require('../Schema')
var OperationStatus = Schema.OperationStatus
var Normalizer = Schema.Normalizer
var Objects = require('../Utility').Objects

/**
 * @param {IExecutor} executor
 * @param {TScenario} scenario
 * @param {LoggerOptions} [loggerOpts]
 *
 * @class
 */
function StateMachine (executor, scenario, loggerOpts) {
  // this list contains all unfinished transitions; as soon as transition
  // has completed or aborted, it is removed from this list
  var transitions = []
  var transition = null
  var states = scenario.states
  var errorHandler = scenario.onError
  var state = null
  var stage = Stage.Idle
  var termination = new Future()
  var logger = Slf4j.factory(loggerOpts, 'ama-team.vsf.execution.state-machine')
  /**
   * @type {TTransitionHistoryEntry[]}
   */
  var history = []
  var entrypoint = Object.keys(states).reduce(function (state, key) {
    return state || (states[key].entrypoint ? states[key] : null)
  }, null)
  if (!entrypoint) {
    throw new ScenarioError('No entrypoint state has been defined')
  }

  /**
   * @param {StateMachine.Stage} next
   */
  function setStage (next) {
    logger.debug('Changing status from {} to {}', stage.id, next.id)
    stage = next
  }

  /**
   * Saves current transition status
   *
   * @param {Transition} t8n
   * @param {*} [value] Transition value (if it has finished)
   */
  function snapshot (t8n, value) {
    var origin = t8n.getOrigin()
    var entry = {
      origin: (origin && origin.id) || null,
      target: t8n.getTarget().id,
      hints: t8n.getHints(),
      status: t8n.getStatus(),
      value: value || null
    }
    history.push(entry)
    while (history.length > 100) {
      history.shift()
    }
  }

  function requireState (id) {
    var state = states[id]
    if (state) {
      return state
    }
    var msg = 'Could not find requested state ' + id + ' in provided scenario'
    throw new ScenarioError(msg)
  }

  /**
   * Triggers transition to specified state
   *
   * @param {TState} target
   * @param {THints} hints
   */
  function transitionTo (target, hints) {
    if (stage.terminal) {
      var message = 'Can\'t launch new transition from stage ' + stage.id
      throw new Errors.IllegalStateError(message)
    }
    var options = {
      logger: loggerOpts,
      origin: state,
      target: target,
      hints: hints || {},
      executor: executor
    }
    return launch(new Transition(options))
  }

  /**
   * Aborts current transition (if any)
   */
  function abort () {
    if (!transition) {
      return
    }
    logger.debug('Aborting current transition {}', transition)
    transition.abort()
    snapshot(transition)
    transition = null
  }

  /**
   * Launches provided transition, aborting running one (if any) and specifying
   * any necessary hooks
   *
   * @param {Transition} t8n
   *
   * @return {Thenable}
   */
  function launch (t8n) {
    abort()
    transition = t8n
    transitions.push(t8n)
    snapshot(t8n)
    setStage(Stage.Running)
    var promise = t8n
      .run()
      .then(null, function (error) {
        logger.error('{} run has rejected', t8n.toString())
        return {
          value: error,
          status: Transition.Stage.Tripped,
          duration: (new Date()).getTime() - t8n.getLaunchedAt().getTime()
        }
      })
    promise.then(processResult.bind(null, t8n))
    return promise
  }

  /**
   * Processes current transition result.
   *
   * @param {Transition} t8n
   * @param {TTransitionResult} result
   */
  function processResult (t8n, result) {
    logger.debug('{} has finished in {} ms', t8n.toString(), result.duration)
    setStage(Stage.Idle)
    snapshot(t8n, result.value)
    var index = transitions.indexOf(t8n)
    transitions = index > -1 ? transitions.splice(index, 1) : transitions
    var current = t8n === transition
    transition = current ? null : transition
    if (!current) {
      return result
    }
    var error = result.value
    if (result.status.successful) {
      try {
        return processSuccess(t8n, result.value)
      } catch (e) {
        error = e
      }
    }
    processError(t8n, error)
  }

  /**
   * Processes transition success.
   *
   * @param {Transition} t8n
   * @param {*} value
   */
  function processSuccess (t8n, value) {
    logger.debug('{} has resolved with {}, processing', t8n.toString(), value)
    value = Normalizer.transition(value)
    var destination = t8n.getTarget()
    if (value.transitionedTo) {
      destination = states[value.transitionedTo]
      if (!destination) {
        var message = t8n + ' reported transition to state ' +
          value.transitionedTo + ' which is not present in scenario states'
        throw new ScenarioError(message)
      }
    }
    logger.debug('Transitioned to {}', destination.id)
    state = destination
    if (state.terminal) {
      logger.info('State `{}` is terminal, halting any further processing',
        state.id)
      terminate(OperationStatus.Finished, value)
      return
    }
    if (!processTrigger(value.trigger || destination.triggers)) {
      logger.info('{} didn\'t trigger transition to next state, doing nothing',
        t8n)
    }
  }

  function processTrigger (trigger) {
    logger.trace('Processing trigger {}', trigger)
    trigger = Normalizer.stateTrigger(trigger)
    if (!trigger || !trigger.id) {
      logger.trace('Trigger did not specify transition to next state')
      return false
    }
    var hints = trigger && trigger.hints
    hints = Objects.isFunction(hints) ? executor.execute(hints) : hints
    transitionTo(requireState(trigger.id), hints)
    return true
  }

  /**
   * Process transition error
   *
   * @param {Transition} t8n
   * @param {Error|*} error
   */
  function processError (t8n, error) {
    setStage(Stage.ErrorHandling)
    if (error instanceof InternalError) {
      logger.error('Framework has thrown an error during {}, halting',
        t8n.toString())
      return terminate(OperationStatus.Tripped, error)
    }
    logger.error('{} has finished with error, running error handler',
      t8n.toString())
    var originId = (t8n.getOrigin() && t8n.getOrigin().id) || null
    var args = [error, originId, t8n.getTarget().id, t8n.getHints()]
    executor
      .runHandler(errorHandler, args)
      .then(function (value) {
        return processTrigger(value && value.trigger)
      }, function (e) {
        logger.error('Outrageous! Error handler has thrown an error ' +
          'itself: {}', e)
      })
      .then(function (success) {
        if (success) {
          logger.notice('Error handler has rescued from {} error', t8n.toString())
          return
        }
        terminate(OperationStatus.Failed, error)
      })
  }

  /**
   * Terminates all processing, forbidding new transitions and resolving
   * termination as soon as all transitions will finish
   *
   * @param {OperationStatus} status
   * @param {*} [value]
   */
  function terminate (status, value) {
    setStage(Stage.Terminating)
    logger.debug('Waiting for {} transitions to finish', transitions.length)
    var promises = transitions.map(function (transition) {
      var silencer = function () {}
      return transition.getCompletion().then(silencer, silencer)
    })
    Promise.all(promises).then(function () {
      setStage(Stage.Terminated)
      termination.resolve({
        status: status,
        value: value || null
      })
    })
  }

  this.terminate = function () {
    if (stage.terminal) {
      var message = 'Can not terminate non-active state machine'
      throw new Errors.IllegalStateError(message)
    }
    abort()
    terminate(OperationStatus.Aborted, null)
    return termination
  }

  /**
   * Returns current states
   *
   * @return {TState}
   */
  this.getState = function () {
    return state
  }

  /**
   *
   * @return {Transition[]}
   */
  this.getTransitions = function () {
    return transitions.slice()
  }

  /**
   *
   * @return {Transition}
   */
  this.getTransition = function () {
    return transition
  }

  /**
   * @param {TStateId} id
   * @param {THints} [hints]
   *
   * @return {Thenable}
   */
  this.transitionTo = function (id, hints) {
    if (stage.restricted) {
      var message = 'State machine is in ' + stage.id + ' state ' +
        'and doesn\'t accept #transitionTo() calls'
      throw new ScenarioError(message)
    }
    return transitionTo(requireState(id), hints)
  }

  /**
   * Runs state machine
   *
   * @param {THints} [hints]
   * @return {Thenable.<TStateMachineResult>}
   */
  this.run = function (hints) {
    transitionTo(entrypoint, hints)
    return termination
  }

  /**
   * @return {StateMachine.Stage}
   */
  this.getStatus = function () {
    return stage
  }

  /**
   * Returns 100 last transition history events
   *
   * @return {TTransitionHistoryEntry[]}
   */
  this.getHistory = function () {
    return history
  }

  /**
   * Returns termination handle
   *
   * @return {Thenable.<TStateMachineResult>}
   */
  this.getTermination = function () {
    return termination
  }
}

/**
 * @typedef {object} StateMachine.Stage~Instance
 *
 * @property {string} id
 * @property {boolean} restricted
 * @property {boolean} terminal
 */

/**
 * @param {string} id
 * @param {boolean} [restricted]
 * @param {boolean} [terminal]
 * @return {StateMachine.Stage~Instance}
 */
var stageFactory = function (id, restricted, terminal) {
  terminal = typeof terminal === 'boolean' ? terminal : restricted
  return {
    id: id,
    restricted: restricted,
    terminal: terminal
  }
}

/**
 * @enum {StateMachine.Stage~Instance}
 * @readonly
 */
StateMachine.Stage = {
  Idle: stageFactory('Idle'),
  Running: stageFactory('Running'),
  ErrorHandling: stageFactory('ErrorHandling', true, false),
  Terminating: stageFactory('Terminating', true),
  Terminated: stageFactory('Terminated', true)
}

var Stage = StateMachine.Stage

module.exports = {
  StateMachine: StateMachine
}
