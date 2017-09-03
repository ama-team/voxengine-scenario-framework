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

/**
 * @param {string} id
 * @param fixture
 *
 * @class
 */
function Scenario (id, fixture) {
  this.id = fixture.id || id
  this.name = fixture.name || this.id
  this.description = fixture.description

  var events
  var logger = Slf4j.factory({}, 'ama-team.vsf.test.acceptance.scenario')

  this.normalize = function () {
    if (!fixture.scenario.trigger) {
      fixture.scenario.trigger = fixture.type
    }
    fixture = Normalizer.normalize(fixture, id)
  }

  this.setup = function () {
    var data = fixture.setup
    var log = data.hasOwnProperty('log') ? data.log : 'fake://log'
    var customData = data.hasOwnProperty('customData') ? data.customData : ''
    var call = {customData: customData}
    events = [
      new AppEvents.Started({logURL: log}),
      new AppEvents.CallAlerting({call: call})
    ]
    customData !== '' && VoxEngine.customData(customData)
  }

  this.execute = function () {
    logger.info('Starting run\n\n\n')
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
  return FileSystem
    .readdirSync(FixtureRoot)
    .filter(function (entry) {
      return FileSystem.statSync(Path.resolve(FixtureRoot, entry)).isDirectory()
    })
}

module.exports = {
  Scenario: Scenario
}
