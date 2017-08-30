var Objects = require('../Utility/Objects').Objects
var Defaults = require('./Defaults')

var Normalizer = {
  stateTrigger: function (trigger) {
    if (typeof trigger === 'string') {
      trigger = {id: trigger}
    }
    if (!Objects.isObject(trigger) || !trigger.id) {
      return null
    }
    var hints = trigger.hints
    if (!Objects.isObject(hints) && !Objects.isFunction(hints)) {
      trigger.hints = {}
    }
    return trigger
  },
  /**
   * Normalizes transition output.
   *
   * @param {TTransitionReturn|string} result
   * @return {TTransitionReturn}
   */
  transition: function (result) {
    result = Objects.copy(result, true)
    if (typeof result === 'string') {
      result = {trigger: result}
    } else if (!Objects.isObject(result)) {
      result = {}
    }
    result.trigger = Normalizer.stateTrigger(result.trigger)
    if (typeof result.transitionedTo !== 'string') {
      result.transitionedTo = null
    }
    return result
  },
  /**
   * @param {TState} state
   * @param {TStateId} id
   * @param {object<string, (int|null)>} timeouts
   * @return {TState}
   */
  state: function (state, id, timeouts) {
    state = Objects.copy(state, true)
    state.id = typeof state.id === 'string' ? state.id : id
    state.entrypoint = !!state.entrypoint
    state.terminal = !!state.terminal
    var handler = state.transition || function () {}
    state.transition = Normalizer.stateHandler(handler, 'transition', timeouts)
    handler = state.abort || function () {}
    state.abort = Normalizer.stateHandler(handler, 'abort', timeouts)
    state.triggers = Normalizer.stateTrigger(state.triggers)
    if (!state.hasOwnProperty('timeout')) {
      state.timeout = timeouts.state
    }
    return state
  },
  /**
   * @param {TStateHandler} handler
   * @param {string} id
   * @param {object<string, (int|null)>} timeouts
   * @return {TStateHandler}
   */
  stateHandler: function (handler, id, timeouts) {
    var cursor = handler && handler.handler
    var defaultHandler = function () { return cursor }
    handler = Normalizer.handler(handler, defaultHandler, id, timeouts)

    defaultHandler = function (a, b, c, error) { throw error }
    var onTimeout = handler.onTimeout
    var timeoutId = 'on' + id[0].toUpperCase() + id.substr(1) + 'Timeout'
    onTimeout = Normalizer.handler(onTimeout, defaultHandler, timeoutId, timeouts)
    handler.onTimeout = onTimeout
    return handler
  },
  handler: function (handler, defaultHandler, id, timeouts) {
    if (Objects.isFunction(handler)) {
      handler = {handler: handler}
    }
    if (!Objects.isObject(handler)) {
      handler = {}
    }
    handler.id = id
    if (!Objects.isFunction(handler.handler)) {
      handler.handler = defaultHandler
    }
    if (!handler.hasOwnProperty('timeout')) {
      handler.timeout = timeouts[id]
    }
    return handler
  },
  /**
   * @param {TScenarioInput} input
   *
   * @return {TScenario}
   */
  scenario: function (input) {
    if (!Objects.isObject(input)) {
      throw new Error('Provided scenario is not an object')
    }
    var scenario = Objects.copy(input, true)
    var timeouts = Objects.copy(Defaults.Timeouts)
    timeouts = Objects.merge(timeouts, input.timeouts || {})

    if (!Objects.isFunction(scenario.onError)) {
      scenario.onError = function () {}
    }
    var handler = scenario.onTermination
    handler = Normalizer.stateHandler(handler, 'termination', timeouts)
    scenario.onTermination = handler
    scenario.states = scenario.states || {}
    Object.keys(scenario.states).forEach(function (key) {
      scenario.states[key] = Normalizer.state(scenario.states[key], key, timeouts)
    })
    scenario.timeout = timeouts.scenario
    return scenario
  }
}

module.exports = {
  Normalizer: Normalizer
}