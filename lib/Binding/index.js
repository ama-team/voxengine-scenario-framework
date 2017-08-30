var sources = ['Started', 'CallAlerting']
var index = {trigger: {}}
/**
 * @namespace
 * @property {Started} Started
 * @property {CallAlerting} CallAlerting
 */
module.exports = {}

sources.forEach(function (name) {
  var binding = require('./' + name)[name]
  index.trigger[binding.getTriggerType()] = binding
  module.exports[name] = binding
})

module.exports.index = index
