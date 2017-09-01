/* global AppEvents, VoxEngine */

var FileSystem = require('fs')
var Path = require('path')

var Normalizer = require('./Scenario/Normalizer').Normalizer
var Validator = require('./Scenario/Validator').Validator
var Verifier = require('./Scenario/Verifier').Verifier

var Framework = require('../../../lib')
var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j

var FixtureRoot = Path.resolve(__dirname, '../../fixture/Scenario')
var LogUrl = 'fake://log'

/**
 * @param {string} id
 * @param fixture
 *
 * @class
 */
function Scenario (id, fixture) {
  this.id = fixture.id || id
  this.name = fixture.name || this.id

  var events
  var logger = Slf4j.factory({}, 'ama-team.vsf.test.acceptance.scenario')

  this.normalize = function () {
    if (!fixture.scenario.trigger) {
      fixture.scenario.trigger = fixture.type
    }
    fixture = Normalizer.normalize(fixture, id)
    logger.info('Starting run\n\n\n')
  }

  this.setup = function () {
    var call = {
      customData: ''
    }
    events = [
      new AppEvents.Started({logURL: LogUrl}),
      new AppEvents.CallAlerting({call: call})
    ]
    if (fixture.setup.customData) {
      VoxEngine.customData(fixture.setup.customData)
      call.customData = fixture.setup.customData
    }
  }

  this.execute = function () {
    var promise = Framework.run(fixture.scenario)
    events.forEach(VoxEngine._emit)
    return promise
  }

  this.verify = function (result) {
    var verifier = new Verifier(fixture)
    verifier.verify(result)
  }

  this.validate = function () {
    return Validator.validate(fixture)
  }

  this.assert = function () {
    this.normalize()
    this.validate()
    this.setup()
    return this.execute().then(this.verify)
  }

  this.toString = function () {
    return 'Fixture ' + id
  }
}

Scenario.load = function (version, id) {
  var path = Path.resolve(FixtureRoot, version, id)
  return new Scenario(id, require(path))
}

Scenario.scenarios = function (version) {
  var path = Path.resolve(FixtureRoot, version)
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
  return FileSystem.readdirSync(FixtureRoot)
}

module.exports = {
  Scenario: Scenario
}
