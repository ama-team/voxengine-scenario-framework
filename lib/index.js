var API = require('./API')
var Schema = require('./Schema')

module.exports = {
  API: API,
  Schema: Schema,
  TriggerType: Schema.TriggerType,
  Framework: API.Framework,
  run: function (input, options) {
    return (new API.Framework(options)).run(input)
  },
  prepare: function (input, options) {
    return (new API.Framework(options)).prepare(input)
  },
  execute: function (run, options) {
    return (new API.Framework(options)).execute(run)
  },
  validate: Schema.Validator.scenario,
  barricade: function (input, options) {
    return (new API.Barricade(options)).scenario(input)
  }
}
