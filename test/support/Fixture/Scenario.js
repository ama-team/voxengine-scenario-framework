var FileSystem = require('fs')
var Path = require('path')

var Objects = require('../../../lib/Utility').Objects

var FIXTURE_ROOT = Path.resolve(__dirname, '../../../fixture/Scenario')

/**
 *
 * @param id
 * @param fixture
 * @constructor
 */

function Scenario (id, fixture) {
  fixture.id = fixture.id || id
  var structure = {
    result: {
      scenario: {},
      termination: {}
    },
    handlers: {
      state: {},
      onError: {},
      onTermination: {}
    }
  }
  fixture.assertions = Objects.merge(structure, fixture.assertions)
  fixture.setup = fixture.setup || {}

  this.validate = function () {
    function error (message) {
      throw new Error('Fixture ' + id + ' ' + message)
    }
    if (!fixture.type) {
      error('doesn\'t specify type')
    }
  }

  this.toString = function () {
    return 'Fixture ' + id
  }
}

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
