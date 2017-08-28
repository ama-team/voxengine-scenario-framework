// noinspection JSUnusedGlobalSymbols
var Defaults = {
  Timeouts: {
    state: null,
    onStateTimeout: 15 * 1000,
    scenario: null,
    onTermination: 15 * 1000,
    onTerminationTimeout: 5 * 1000,
    transition: 45 * 1000,
    onTransitionTimeout: 15 * 1000,
    abort: 45 * 1000,
    onAbortTimeout: 15 * 1000
  },
  Handlers: {
    Action: function () { return Promise.resolve({}) },
    ActionTimeout: function (p, h, t, e) { return Promise.reject(e) },
    StateTimeout: function (t, e) { return Promise.reject(e) },
    ScenarioTimeout: function () { return Promise.resolve({}) },
    Termination: function () { return Promise.resolve({}) },
    TerminationTimeout: function (t, e) { return Promise.reject(e) }
  }
}

/**
 * @enum
 * @readonly
 */
var TriggerType = {
  Http: 'Http',
  Call: 'Call'
}

/**
 * Specifies the cause of termination. May be used on all levels.
 *
 * @enum
 * @readonly
 */
var TerminationCause = {
  Completion: 'Completion',
  Abortion: 'Abortion',
  TransitionFailure: 'TransitionFailed',
  TransitionTimeout: 'TransitionTimeout',
  AbortFailure: 'AbortFailure',
  AbortTimeout: 'AbortTimeout',
  StateTimeout: 'StateTimeout',
  ScenarioTimeout: 'ScenarioTimeout',
  /**
   * End user has touched things in order he shouldn't have
   */
  InvalidUsage: 'InvalidUsage',
  /**
   * Framework has gone rogue
   */
  FrameworkFailure: 'FrameworkFailure'
}

/**
 * Explains why and how transition has ended.
 *
 * @class
 *
 * @param {TerminationCause} cause
 * @param {Directive|null} [directive]
 * @param {Error|null} [error]
 *
 * @property {TerminationCause} cause
 * @property {Directive|null} directive
 * @property {Error|null} error
 */
function TransitionResult (cause, directive, error) {
  this.success = cause === TerminationCause.Completion
  this.cause = cause
  this.directive = directive || null
  this.error = error || null
}

/**
 * Explains why and how state machine has terminated.
 *
 * @class
 *
 * @param {TerminationCause} cause
 * @param {Error|null} [error]
 * @param {State} [state]
 *
 * @property {TerminationCause} cause
 * @property {Error|null} error
 * @property {State|null} state
 */
function MachineTerminationResult (cause, error, state) {
  this.success = cause === TerminationCause.Completion
  this.cause = cause
  this.error = error || null
  this.state = state || null
}

/**
 * Explains why and how state machine has terminated.
 *
 * @class
 *
 * @param {TerminationCause} cause
 * @param {Error|null} error
 * @param {State} [state]
 * @param {string} [message]
 */
function ExecutionResult (cause, error, state, message) {
  this.success = cause === TerminationCause.Completion
  this.cause = cause
  this.error = error || null
  this.state = state || null
  this.message = message || null
  this.terminationError = null
}

ExecutionResult.illegal = function (message, error) {
  return new ExecutionResult(TerminationCause.InvalidUsage, error, null, message)
}
ExecutionResult.failure = function (error, message) {
  return new ExecutionResult(TerminationCause.FrameworkFailure, error, null, message)
}
ExecutionResult.scenarioTimeout = function (message, state) {
  return new ExecutionResult(TerminationCause.ScenarioTimeout, null, state, message)
}

/**
 * Specifies various timeouts.
 *
 * @class
 *
 * @param {Timeouts|object} [raw] Raw timeouts
 *
 * @property {number|null} transition
 * @property {number|null} abort
 * @property {number|null} onTransitionTimeout
 * @property {number|null} abort
 * @property {number|null} onAbortTimeout
 * @property {number|null} state
 * @property {number|null} scenario
 * @property {number|null} onTermination
 * @property {number|null} onTerminationTimeout
 */
function Timeouts (raw) {
  var keys = [
    'transition',
    'onTransitionTimeout',
    'abort',
    'onAbortTimeout',
    'state',
    'scenario',
    'onTermination',
    'onTerminationTimeout'
  ]

  this.fill = function (o) {
    var s = this
    o = o || {}
    keys.forEach(function (k) {
      if (k in o) { s[k] = (o[k] || null) }
    })
    return this
  }

  this.copy = function () { return new Timeouts(this) }

  this.fill(raw)
}

Timeouts.defaults = function () { return new Timeouts(Defaults.Timeouts) }

/**
 * @class
 *
 * @param {State[]} states Scenario states.
 * @param {TriggerType} trigger Defines how scenario should be triggered.
 * @param {string} [id] Scenario id, used for logging only.
 * @param {string} [version] Scenario version, used for logging only.
 * @param {string} [environment] Scenario environment, used for logging only.
 *
 * @property {string|undefined} id Scenario id, used for logging only.
 * @property {string|undefined} version Scenario version, used for logging only.
 * @property {string|undefined} environment Scenario environment, used for logging only.
 * @property {State[]} states Scenario states.
 * @property {Scenario.terminationHandler} onTermination Handler that will be called upon scenario termination.
 * @property {Scenario.terminationTimeoutHandler} onTerminationTimeout Handler that will be called upon scenario
 *   termination handler timeout.
 * @property {TriggerType} trigger Defines how scenario should be triggered.
 * @property {Timeouts} timeouts Default timeout values.
 */
function Scenario (states, trigger, id, version, environment) {
  this.id = id || undefined
  this.version = version || undefined
  this.environment = environment || undefined
  this.states = states || []
  this.onTermination = null
  this.onTerminationTimeout = null
  this.trigger = trigger || null
  this.timeouts = new Timeouts()

  this.toString = function () {
    return 'TScenario ' + id + ' (version: ' + version + ', environment: ' + environment + ')'
  }
}

/**
 * @callback Scenario.terminationHandler
 *
 * @param {CancellationToken} cancellationToken
 *
 * @return {Promise.<*>}
 */

/**
 * @callback Scenario.terminationTimeoutHandler
 *
 * @param {CancellationToken} cancellationToken
 * @param {TimeoutException} error
 *
 * @return {Promise.<*>}
 */

/**
 * @class
 *
 * @param {string} id
 * @param {boolean|*} [entrypoint]
 * @param {boolean|*} [terminal]
 *
 * @property {string} [id]
 * @property {boolean} [entrypoint]
 * @property {boolean} [terminal]
 * @property {State.actionHandler} transition
 * @property {State.actionTimeoutHandler} onTransitionTimeout
 * @property {State.actionHandler} abort
 * @property {State.actionTimeoutHandler} onAbortTimeout
 * @property {State.timeoutHandler} onTimeout
 * @property {Timeouts} timeouts
 */
function State (id, entrypoint, terminal) {
  this.id = id || null
  this.entrypoint = !!entrypoint
  this.terminal = !!terminal
  this.transition = null
  this.onTransitionTimeout = null
  this.abort = null
  this.onAbortTimeout = null
  this.onTimeout = null
  this.timeouts = new Timeouts()
}

/**
 * @callback State.actionHandler
 *
 * @param {State} previousState
 * @param {object} hints
 * @param {CancellationToken} cancellationToken
 *
 * @return {Promise.<TransitionResult>}
 */

/**
 * @callback State.actionTimeoutHandler
 *
 * @param {State} previousState
 * @param {object} hints
 * @param {CancellationToken} cancellationToken
 * @param {TimeoutException} error
 *
 * @return {Promise.<TransitionResult>}
 */

/**
 * @callback State.timeoutHandler
 *
 * @param {TimeoutException} error
 * @param {CancellationToken} cancellationToken
 *
 * @return {Promise.<TransitionResult>}
 */

/**
 * A structure to tell framework where it is and which state should be next.
 *
 * @class
 *
 * @param {string} transitionedTo
 * @param {Trigger} trigger
 */
function Directive (transitionedTo, trigger) {
  this.transitionedTo = transitionedTo
  this.trigger = trigger
}

/**
 * A structure to trigger framework transition.
 *
 * @class
 *
 * @param {string} id Triggered state id.
 * @param {object} hints User-defined hints.
 */
function Trigger (id, hints) {
  this.id = id || null
  this.hints = hints || {}
}

exports = module.exports = {
  Defaults: Defaults,
  TriggerType: TriggerType,
  TerminationCause: TerminationCause,
  Directive: Directive,
  Trigger: Trigger,
  TransitionResult: TransitionResult,
  MachineTerminationResult: MachineTerminationResult,
  ExecutionResult: ExecutionResult,
  Timeouts: Timeouts,
  Scenario: Scenario,
  State: State
}
