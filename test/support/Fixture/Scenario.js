var FileSystem = require('fs')
var Path = require('path')

var FIXTURE_ROOT = Path.resolve(__dirname, '../../../fixture/Scenario')

function Scenario (id, fixture) {}

Scenario.load = function (version, id) {
  var path = Path.resolve(FIXTURE_ROOT, version, id)
  var scenario = new Scenario(id, require(path))
  scenario.validate()
  return scenario
}

Scenario.scenarios = function (version) {
  var path = Path.resolve(FIXTURE_ROOT, version)
  return FileSystem
    .readdirSync(path)
    .filter(function (entry) {
      return entry.indexOf('.js') === entry.length - 3
    })
    .map(function (entry) {
      return entry.substr(0, entry.length - 3)
    })
}

Scenario.versions = function () {
  return FileSystem.readdirSync(FIXTURE_ROOT)
}

module.exports = {
  Scenario: Scenario
}
