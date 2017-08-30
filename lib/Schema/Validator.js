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
    if (!input.onError) {
      violations.push('$.onError', 'onError handler is missing', Severity.Minor)
    }
    if (!input.onTermination) {
      violation = 'onTermination handler is missing'
      violations.push('$.onTermination', violation, Severity.Minor)
    }
    if (!input.argumentDeserializer) {
      violation = 'Argument deserializer is not set, default will be used'
      violations.push('$.argumentDeserializer', violation, Severity.Minor)
    } else if (!Objects.isFunction(input.argumentDeserializer)) {
      violation = 'Argument deserializer is not a function'
      violations.push('$.argumentDeserializer', violation, Severity.Fatal)
    }
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
    if (!Objects.isObject(state)) {
      return violations.push(path, 'Is not an object', Severity.Fatal)
    }
    if (!state.abort) {
      violations.push(path + '.abort', 'Abort handler is missing', Severity.Minor)
    }
    if (!state.transition) {
      var violation = 'Transition handler is missing. While this is not ' +
        'exactly an error and is allowed, this is usually a sign of ' +
        'half-written scenario.'
      violations.push(path + '.transition', violation, Severity.Major)
    }
    return violations
  }
}

module.exports = {
  Validator: Validator
}
