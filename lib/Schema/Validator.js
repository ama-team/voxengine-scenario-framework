var Objects = require('../Utility').Objects
var TriggerType = require('./TriggerType').TriggerType

var severityFactory = function (id, weight) {
  return {
    id: id,
    weight: weight
  }
}

/**
 * @enum
 * @readonly
 */
var Severity = {
  None: severityFactory('None', 0),
  Minor: severityFactory('Minor', 1),
  Major: severityFactory('Major', 2),
  Fatal: severityFactory('Fatal', 3)
}

/**
 * @typedef {object} TViolation
 *
 * @property {string} message
 * @property {Severity} severity
 */

/**
 * A simple wrapper for list of violations, grouped by path.
 *
 * @class
 *
 * @property {Object.<string, TViolation[]>} violations Violations grouped by
 *   path
 * @property {Severity} severity
 */
function ViolationSet () {
  var self = this
  var violations = {}
  var severity = Severity.None

  function updateSeverity (l) {
    severity = l.weight > severity.weight ? l : severity
  }

  /**
   * @param {string} path
   * @param {string} message
   * @param {Severity} severity
   * @return {ViolationSet}
   */
  this.push = function (path, message, severity) {
    violations[path] = violations[path] ? violations[path] : []
    violations[path].push({message: message, severity: severity})
    updateSeverity(severity)
    return self
  }

  this.merge = function (other) {
    Object.keys(other.violations).forEach(function (path) {
      other.violations[path].forEach(function (violation) {
        self.push(path, violation.message, violation.severity)
      })
    })
    return self
  }

  Object.defineProperties(this, {
    severity: {get: function () { return severity }},
    violations: {get: function () { return violations }}
  })
}

var Validator = {
  Severity: Severity,
  ViolationSet: ViolationSet,
  /**
   * @param {TScenarioInput} input
   *
   * @return ViolationSet
   */
  scenario: function (input) {
    var violations = new ViolationSet()
    var violation
    var handlers = ['deserializer', 'onError', 'onTermination']
    handlers.forEach(function (handler) {
      var path = '$.' + handler
      if (!input[handler]) {
        var message = handler + ' handler is missing, default will be used'
        violations.push(path, message, Severity.Minor)
      } else {
        violations.merge(Validator.handler(input[handler], path))
      }
    })
    if (!TriggerType.find(input.trigger)) {
      violation = 'Scenario trigger type is not set or invalid'
      violations.push('$.trigger', violation, Severity.Fatal)
    }
    var states = input.states
    if (!Objects.isObject(states)) {
      violations.push('$.states', 'Expected to be an object', Severity.Fatal)
      states = {}
    }
    var terminalStates = 0
    var entrypointStates = 0
    Object.keys(states).forEach(function (id) {
      var state = states[id]
      violations.merge(Validator.state(state, '$.states.' + id))
      entrypointStates += state && state.entrypoint ? 1 : 0
      terminalStates += state && state.terminal ? 1 : 0
    })
    if (terminalStates === 0) {
      violations.push('$.states', 'No terminal state is defined', Severity.Fatal)
    }
    if (entrypointStates !== 1) {
      violation = entrypointStates + ' entrypoint states are defined ' +
        '(exactly one expected)'
      violations.push('$.states', violation, Severity.Fatal)
    }
    return violations
  },
  /**
   * @param {TStateInput} state
   * @param {string} [path]
   *
   * @return {ViolationSet}
   */
  state: function (state, path) {
    path = path || '$'
    var violations = new ViolationSet()
    if (Objects.isFunction(state)) {
      return violations
    }
    if (!Objects.isObject(state)) {
      return violations.push(path, 'Is not an object', Severity.Fatal)
    }
    var handlers = {transition: Severity.Fatal, abort: Severity.Minor}
    Object.keys(handlers).forEach(function (key) {
      var prop = path + '.' + key
      if (!state[key]) {
        violations.push(prop, key + ' handler is missing', handlers[key])
      } else {
        violations.merge(Validator.handler(state[key], prop))
      }
    })
    return violations
  },
  handler: function (handler, path) {
    path = path || '$'
    var violations = new ViolationSet()
    if (!handler) {
      return violations
    }
    var callable = handler
    if (Objects.isObject(handler)) {
      violations.merge(Validator.handler(handler.onTimeout, path + '.onTimeout'))
      callable = handler.handler
    }
    if (!Objects.isFunction(callable)) {
      var message = 'Neither handler itself or handler.handler is a function'
      violations.push(path, message, Severity.Fatal)
    }
    return violations
  }
}

module.exports = {
  Validator: Validator
}
