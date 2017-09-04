var API = require('./API')
var Schema = require('./Schema')

module.exports = {
  API: API,
  Schema: Schema,
  TriggerType: Schema.TriggerType,
  Framework: API.Framework,
  Utility: require('./Utility'),
  /**
   * Runs provided scenario
   *
   * @param {TScenarioInput} scenario
   * @param {TFrameworkOptions} options
   *
   * @return {Thenable.<TRunResult>}
   */
  run: function (scenario, options) {
    return (new API.Framework(options)).run(scenario)
  },
  /**
   * Prepares run, but doesn't execute it
   *
   * @param {TScenarioInput} scenario
   * @param {TFrameworkOptions} options
   * @return {Run}
   */
  prepare: function (scenario, options) {
    return (new API.Framework(options)).prepare(scenario)
  },
  /**
   * Executes prepared Run
   *
   * @param {Run} run
   * @param {TFrameworkOptions} options
   *
   * @return {TRunResult}
   */
  execute: function (run, options) {
    return (new API.Framework(options)).execute(run)
  },
  /**
   * Validates provided scenario
   *
   * @return {ViolationSet}
   */
  validate: Schema.Validator.scenario,
  /**
   * Normalizes provided scenario or throws an error, if scenario is
   * non-normalizable.
   *
   * @param {TScenarioInput} scenario
   * @param {TBarricadeOptions} options
   *
   * @return {TScenario}
   */
  barricade: function (scenario, options) {
    return (new API.Barricade(options)).scenario(scenario)
  }
}
