var Defaults = require('./Defaults').Timeouts

/**
 * @typedef {int|null} Timeouts~Timeout
 */

/**
 * Timeouts structure
 *
 * @param {object} [opts]
 * @class
 *
 * @property {Timeouts~Timeout} scenario
 * @property {Timeouts~Timeout} onScenarioTimeout
 * @property {Timeouts~Timeout} state
 * @property {Timeouts~Timeout} onStateTimeout
 * @property {Timeouts~Timeout} transition
 * @property {Timeouts~Timeout} onTransitionTimeout
 * @property {Timeouts~Timeout} abort
 * @property {Timeouts~Timeout} onAbortTimeout
 */
function Timeouts (opts) {
  opts = opts || {}
  var self = this

  self.merge = function (other) {
    Object.keys(Defaults).forEach(function (key) {
      self[key] = other.hasOwnProperty(key) ? other[key] : Defaults[key]
    })
  }

  self.merge(opts)
}

module.exports = {
  Timeouts: Timeouts
}
