var API = require('./API')
var Schema = require('./Schema')

module.exports = {
  API: API,
  Schema: Schema,
  TriggerType: Schema.TriggerType,
  Framework: API.Framework,
  Utility: require('./Utility'),
  run: function (scenario, options) {
    return (new API.Framework(options)).run(scenario)
  },
  prepare: function (scenario, options) {
    return (new API.Framework(options)).prepare(scenario)
  },
  execute: function (run, options) {
    return (new API.Framework(options)).execute(run)
  },
  validate: Schema.Validator.scenario,
  barricade: function (scenario, options) {
    return (new API.Barricade(options)).scenario(scenario)
  }
}
