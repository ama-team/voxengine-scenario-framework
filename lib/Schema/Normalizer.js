var Objects = require('../Utility').Objects
var Defaults = require('./Defaults')
var Errors = require('../Error')

var Normalizer = {
  /**
   * @param {TStateTrigger|string} trigger
   * @return {TStateTrigger}
   */
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
   * @param {TState|Function} state
   * @param {TStateId} id
   * @param {object<string, (int|null)>} timeouts
   * @return {TState}
   */
  state: function (state, id, timeouts) {
    if (Objects.isFunction(state)) {
      state = {transition: state}
    }
    state = Objects.copy(state, true)
    state.id = typeof state.id === 'string' ? state.id : id
    state.entrypoint = !!state.entrypoint
    state.terminal = !!state.terminal
    var handler = state.transition || function () {}
    state.transition = Normalizer.handler(handler, 'transition', timeouts)
    handler = state.abort || function () {}
    state.abort = Normalizer.handler(handler, 'abort', timeouts)
    state.triggers = Normalizer.stateTrigger(state.triggers)
    if (!state.hasOwnProperty('timeout')) {
      state.timeout = timeouts.state
    }
    return state
  },
  /**
   * @param {TStateHandler|Function} handler
   * @param {string} id
   * @param {object<string, (int|null)>} timeouts
   *
   * @return {TStateHandler}
   */
  handler: function (handler, id, timeouts) {
    var cursor = handler && handler.handler
    var defaultHandler = function () { return cursor }
    handler = Normalizer.singleHandler(handler, defaultHandler, id, timeouts)
    if (handler.onTimeout) {
      var name = 'on' + id[0].toUpperCase() + id.substr(1) + 'Timeout'
      handler.onTimeout = Normalizer.handler(handler.onTimeout, name, timeouts)
    }
    return handler
  },
  /**
   * @param {TStateHandler|Function} handler
   * @param {Function} defaultHandler
   * @param {string} id
   * @param {object<string, (int|null)>} timeouts
   *
   * @return {TStateHandler}
   */
  singleHandler: function (handler, defaultHandler, id, timeouts) {
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
      throw new Errors.InvalidInputError('Provided scenario is not an object')
    }
    var scenario = Objects.copy(input, true)
    var timeouts = Objects.copy(Defaults.Timeouts)
    timeouts = Objects.merge(timeouts, input.timeouts || {})
    var handlers = ['onError', 'onTermination']
    handlers.forEach(function (name) {
      scenario[name] = Normalizer.handler(scenario[name], name, timeouts)
    })
    scenario.states = scenario.states || {}
    Object.keys(scenario.states).forEach(function (key) {
      scenario.states[key] = Normalizer.state(scenario.states[key], key, timeouts)
    })
    scenario.timeout = timeouts.scenario
    scenario.deserializer = Normalizer.deserializer(scenario.deserializer, timeouts)
    return scenario
  },
  /**
   * @param {THandler|Function|*} handler
   * @param {object.<string, (int|null)>} timeouts
   *
   * @return {TStateHandler}
   */
  deserializer: function (handler, timeouts) {
    if (!Objects.isObject(handler)) {
      handler = {handler: handler}
    }
    if (!Objects.isFunction(handler.handler)) {
      // TODO: pass logger options
      handler.handler = Defaults.Deserializer.factory()
    }
    return Normalizer.handler(handler, 'deserializer', timeouts)
  }
}

module.exports = {
  Normalizer: Normalizer
}
