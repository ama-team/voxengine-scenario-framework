var UserError = require('./Error').UserError
var Execution = require('./Execution').Execution

/**
 * @typedef {object} Runner~Options
 *
 * @property {FEnvironmentDeserializer} deserializer
 * @property {LoggerOptions} [logger]
 * @property {object} [arguments]
 * @property {object} [state]
 */

/**
 * This terribly simple class exists only as proxy between public interface with
 * flaky inputs and framework insides with determined inputs and outputs
 *
 * @param {TScenario} scenario
 * @param {Runner~Options} options
 * @class
 */
function Runner (scenario, options) {
  /**
   * @param {TScenarioTrigger} trigger
   *
   * @return {Thenable.<TExecutionResult|Error>}
   */
  this.run = function (trigger) {
    var execution = new Execution(scenario, options)
    var args
    try {
      args = options.deserializer(trigger.arguments) || {}
    } catch (e) {
      var message = 'Unexpected error during arguments deserialization'
      return Promise.reject(new UserError(message, e))
    }
    return execution.run(trigger, args)
  }
}

module.exports = {
  Runner: Runner
}
