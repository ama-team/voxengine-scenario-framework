/**
 * @class ValidationResult
 *
 * @property {boolean} valid
 * @property {object.<string, string[]>} violations Found violations in
 *   `{'dot.separated.property.path': ['violations']}` format.
 */

/**
 * Validates provided scenario
 *
 * @param {Scenario} scenario
 *
 * @return {ValidationResult}
 */
function validateScenario (scenario) {
  var valid = true
  var violations = {
    states: []
  }
  var entrypoints = 0
  var terminalStates = 0

  if (!scenario.id) {
    violations.id = ['Scenario id not provided']
  }
  if (!scenario.version) {
    violations.version = ['Scenario version not provided']
  }
  if (!scenario.environment) {
    violations.environment = ['Scenario environment not provided']
  }
  if (!scenario.trigger) {
    valid = false
    violations.trigger = ['Scenario trigger not provided']
  }
  if (!scenario.timeouts) {
    valid = false
    violations.timeouts = ['Scenario timeouts not provided']
  }
  var stateIds = {}
  scenario.states.forEach(function (state) {
    var result = validateState(state)
    var path = 'states.' + (state.id ? state.id : 'undefined-' + Math.random())
    if (state.terminal) { terminalStates++ }
    if (state.entrypoint) { entrypoints++ }
    if (!(path in stateIds)) { stateIds[path] = 0 }
    stateIds[path]++
    if (result.valid) { return }
    valid = false
    Object.keys(result.violations).forEach(function (key) {
      violations[path + '.' + key] = result.violations[key]
    })
  })
  if (entrypoints === 0) {
    valid = false
    violations.states.push('No entrypoint state defined')
  }
  if (entrypoints > 1) {
    valid = false
    violations.states.push('Multiple entrypoint states defined')
  }
  if (terminalStates === 0) {
    valid = false
    violations.states.push('No terminal states defined')
  }
  if (!violations.states.length) {
    delete violations.states
  }

  Object.keys(stateIds).forEach(function (k) {
    var v = stateIds[k]
    if (v > 1) {
      valid = false
      violations[k] = ['Several states defined with this id']
    }
  })

  var hooks = ['onTermination', 'onTerminationTimeout']
  hooks.forEach(function (h) {
    if (typeof scenario[h] !== 'function') {
      valid = false
      violations[h] = ['Missing ' + h + ' handler']
    }
  })

  // noinspection JSValidateTypes
  return {
    valid: valid,
    violations: violations
  }
}

/**
 * Validates provided state
 *
 * @param {ScenarioState} state
 *
 * @return {ValidationResult}
 */
function validateState (state) {
  var valid = true
  var violations = []

  if (!state.id) {
    valid = false
    violations.id = ['Missing state id']
  }
  if (!state.timeouts) {
    valid = false
    violations.timeouts = ['Missing state timeouts']
  }
  var hooks = ['transition', 'onTransitionTimeout', 'abort', 'onAbortTimeout', 'onTimeout']
  hooks.forEach(function (handler) {
    if (typeof state[handler] !== 'function') {
      valid = false
      violations[handler] = ['Handler ' + handler + ' is not a function']
    }
  })

  return {
    valid: valid,
    violations: violations
  }
}

exports = module.exports = {
  validate: validateScenario,
  validateState: validateState
}
