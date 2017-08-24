var SDK = require('@ama-team/voxengine-sdk')
var Future = SDK.Concurrent.Future
var Slf4j = SDK.Logger.Slf4j
var Transition = require('./Transition').Transition

/**
 * @param {IStateCollection} states
 * @param {IExecutor} executor
 * @param {LoggerOptions} loggerOpts
 *
 * @class
 */
function StateMachine (states, executor, loggerOpts) {
  // this list contains all unfinished transitions; as soon as transition
  // has completed or aborted, it is removed from this list
  var transitions = []
  var transition
  var state
  var status = Status.Idle
  var termination = new Future()
  var loggerName = 'ama-team.vsf.execution.state-machine'
  var logger = Slf4j.factory(loggerOpts, loggerName)

  /**
   * @param {StateMachine.Status} next
   */
  function setStatus (next) {
    logger.debug('Changing status from {} to {}', status.name, next.name)
    status = next
  }

  /**
   * Triggers transition to specified state
   *
   * @param {State} target
   * @param {Hints} hints
   */
  function transitionTo (target, hints) {
    if (!status.accepting) {
      throw new Error('Can\'t launch new transition from status' + status)
    }
    var options = {
      logger: loggerOpts,
      origin: state,
      target: target,
      hints: hints,
      executor: executor
    }
    launch(new Transition(options))
  }

  function abort () {
    if (!transition) {
      return
    }
    logger.debug('Aborting current transition {}', transition)
    transitions.push(transition)
    transition.abort()
    transition = null
  }

  function launch (t8n) {
    abort()
    transition = t8n
    setStatus(Status.Running)
    t8n
      .run()
      .then(null, function (error) {
        logger.error('{} run has rejected', t8n)
        return {
          value: error,
          status: Transition.Status.Tripped,
          duration: (new Date()).getTime() - t8n.getLaunchedAt().getTime()
        }
      })
      .then(processResult.bind(null, t8n))
  }

  /**
   * Processes current transition result.
   *
   * @param {Transition} t8n
   * @param {ITransitionResult} result
   */
  function processResult (t8n, result) {
    logger.debug('{} has finished in {} ms', t8n, result.duration)
    setStatus(Status.Idle)
    var index = transitions.indexOf(t8n)
    transitions = index > -1 ? transitions.splice(index, 1) : transitions
    var current = t8n === transition
    transition = current ? null : transition
    if (!current) {
      return
    }
    var error
    if (result.status.successful) {
      try {
        processSuccess(t8n, result.value)
      } catch (e) {
        error = e
      }
    } else {
      error = result.value
    }
    if (error) {
      processError(t8n, error)
    }
  }

  function processSuccess (t8n, value) {
    logger.debug('{} has resolved with {}, processing', t8n, value)
    var destination = value.transitionedTo || t8n.getTarget().id
    if (!states[destination]) {
      var message = t8n + ' reported transition to state ' + destination +
        ' which is not present in scenario states'
      throw new Error(message)
    }
    logger.debug('Transitioned to {}', destination)
    state = states[destination]
    if (state.terminal) {
      logger.info('State {} is terminal, halting any further processing', state)
      terminate()
      return
    }
    var trigger = value.trigger || destination.triggers
    if (!trigger || !trigger.id) {
      logger.info('{} didn\'t trigger transition to next state, doing nothing',
        t8n)
      return
    }
    var target = states[trigger.id]
    if (!target) {
      throw new Error(t8n + ' result triggers transition to `' + trigger.id +
        '`, but there is no such state in scenario')
    }
    var hints = trigger && trigger.hints
    hints = typeof hints === 'function' ? executor.execute(hints) : hints
    transitionTo(target, hints)
  }

  function processError (t8n, error) {
    logger.notice('Triggering onError state because current transition {} ' +
      'has finished with error {}', t8n, error)
    return transitionTo(states.onError, {error: error})
  }

  /**
   * Terminates all processing, forbidding new transitions and resolving
   * termination as sson as all transitions will finish
   */
  function terminate () {
    setStatus(Status.Terminating)
    logger.debug('Waiting for {} transition to finish', transitions.length)
    var promises = transitions.map(function (transition) {
      return transition.getCompletion().then(null, function () {})
    })
    Promise.all(promises).then(function () {
      setStatus(Status.Terminated)
      termination.resolve()
    })
  }

  /**
   * Returns current states
   *
   * @return {State}
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

  this.transitionTo = transitionTo

  /**
   * @param {Hints} hints
   * @return {Thenable}
   */
  this.run = function (hints) {
    transitionTo(states.entrypoint, hints)
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
 *
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
  Terminating: statusFactory('Terminating'),
  Terminated: statusFactory('Terminated')
}

var Status = StateMachine.Status

module.exports = {
  StateMachine: StateMachine
}
