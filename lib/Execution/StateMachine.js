var SDK = require('@ama-team/voxengine-sdk')
var Future = SDK.Concurrent.Future
var Slf4j = SDK.Logger.Slf4j
var Transition = require('./Transition').Transition
var Errors = require('../Error')
var InternalError = Errors.InternalError
var ScenarioError = Errors.ScenarioError
var OperationStatus = require('../Schema').OperationStatus

/**
 * @callback StateMachine~errorHandler
 *
 * @param {Error|*} error
 * @param {TStateId} [origin]
 * @param {TStateId} [target]
 * @param {THints} [hints]
 */

/**
 * @typedef {object} StateMachine~Result
 *
 * @property {*|Error} value
 * @property {StateMachine.Status} status
 */

/**
 * @param {IExecutor} executor
 * @param {object.<TStateId, TState>} states
 * @param {TErrorHandler} [errorHandler]
 * @param {LoggerOptions} [loggerOpts]
 *
 * @class
 *
 * TODO: external termination
 */
function StateMachine (executor, states, errorHandler, loggerOpts) {
  // this list contains all unfinished transitions; as soon as transition
  // has completed or aborted, it is removed from this list
  var transitions = []
  var transition = null
  var state = null
  var status = Status.Idle
  var termination = new Future()
  var loggerName = 'ama-team.vsf.execution.state-machine'
  var logger = Slf4j.factory(loggerOpts, loggerName)
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
  errorHandler = errorHandler || function () {}

  /**
   * @param {StateMachine.Status} next
   */
  function setStatus (next) {
    logger.debug('Changing status from {} to {}', status.name, next.name)
    status = next
  }

  function saveTransitionStatus (t8n, value) {
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
    if (!status.accepting) {
      var message = 'Can\'t launch new transition from status' + status
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
    saveTransitionStatus(transition)
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
    saveTransitionStatus(t8n)
    setStatus(Status.Running)
    var promise = t8n
      .run()
      .then(null, function (error) {
        logger.error('{} run has rejected', t8n.toString())
        return {
          value: error,
          status: Transition.Status.Tripped,
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
    setStatus(Status.Idle)
    saveTransitionStatus(t8n, result.value)
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
    var destination = t8n.getTarget()
    var transitionedTo = (value && value.transitionedTo)
    if (transitionedTo) {
      destination = states[transitionedTo]
      if (!destination) {
        var message = t8n + ' reported transition to state ' + destination +
          ' which is not present in scenario states'
        throw new ScenarioError(message)
      }
    }
    logger.debug('Transitioned to {}', destination)
    state = destination
    if (state.terminal) {
      logger.info('State {} is terminal, halting any further processing',
        state.id)
      terminate(OperationStatus.Finished, value)
      return
    }
    var trigger = (value && value.trigger) || destination.triggers
    // TODO: use normalizer instead of manual checking
    if (typeof trigger === 'string') {
      trigger = {id: trigger}
    }
    if (!trigger || !trigger.id) {
      logger.info('{} didn\'t trigger transition to next state, doing nothing',
        t8n)
      return
    }
    var hints = trigger && trigger.hints
    hints = typeof hints === 'function' ? executor.execute(hints) : hints
    transitionTo(requireState(trigger.id), hints)
  }

  /**
   * Process transition error
   *
   * @param {Transition} t8n
   * @param {Error|*} error
   */
  function processError (t8n, error) {
    setStatus(Status.ErrorHandling)
    var status
    var future
    if (error instanceof InternalError) {
      logger.error('Framework has thrown an error during {}, halting',
        t8n.toString())
      status = OperationStatus.Tripped
      future = Promise.resolve()
    } else {
      logger.error('{} has finished with error, running error handler',
        t8n.toString())
      status = OperationStatus.Failed
      var originId = (t8n.getOrigin() && t8n.getOrigin().id) || null
      var args = [error, originId, t8n.getTarget().id, t8n.getHints()]
      future = executor
        .promise(errorHandler, args)
        .then(null, function (e) {
          logger.error('Outrageous! Error handler has thrown an error ' +
            'itself: {}', e)
        })
    }
    return future.then(terminate.bind(null, status, error))
  }

  /**
   * Terminates all processing, forbidding new transitions and resolving
   * termination as soon as all transitions will finish
   *
   * @param {OperationStatus} status
   * @param {*} [value]
   */
  function terminate (status, value) {
    setStatus(Status.Terminating)
    logger.debug('Waiting for {} transitions to finish', transitions.length)
    var promises = transitions.map(function (transition) {
      var silencer = function () {}
      return transition.getCompletion().then(silencer, silencer)
    })
    Promise.all(promises).then(function () {
      setStatus(status)
      termination.resolve({
        status: status,
        value: value || null
      })
    })
  }

  this.terminate = function () {
    // TODO: current status check
    abort()
    terminate(OperationStatus.Aborted, null)
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
    if (!status.accepting) {
      var message = 'State machine is in ' + status.name + ' state ' +
        'and doesn\'t accept #transitionTo() calls'
      throw new ScenarioError(message)
    }
    return transitionTo(requireState(id), hints)
  }

  /**
   * Runs state machine
   *
   * @param {THints} [hints]
   * @return {Thenable.<StateMachine~Result>}
   */
  this.run = function (hints) {
    transitionTo(entrypoint, hints)
    return termination
  }

  /**
   * @return {StateMachine.Status}
   */
  this.getStatus = function () {
    return status
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
   * @return {Thenable.<StateMachine~Result>}
   */
  this.getTermination = function () {
    return termination
  }
}

/**
 * @typedef {object} StateMachine.Status~Instance
 *
 * @property {string} name
 * @property {boolean} accepting
 */

/**
 * @param {string} name
 * @param {boolean} [closed]
 * @return {StateMachine.Status~Instance}
 */
var statusFactory = function (name, closed) {
  return {
    name: name,
    accepting: !closed
  }
}

/**
 * @enum {StateMachine.Status~Instance}
 * @readonly
 */
StateMachine.Status = {
  Idle: statusFactory('Idle'),
  Running: statusFactory('Running'),
  Terminating: statusFactory('Terminating', true),
  ErrorHandling: statusFactory('ErrorHandling', true),
  Finished: statusFactory('Finished', true),
  Failed: statusFactory('Failed', true),
  Tripped: statusFactory('Tripped', true)
}

var Status = StateMachine.Status

module.exports = {
  StateMachine: StateMachine
}
