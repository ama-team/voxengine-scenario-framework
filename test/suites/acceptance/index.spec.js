/* eslint-env mocha */

var Fixture = require('../../support/Fixture/Scenario').Scenario
var Stubs = require('@ama-team/voxengine-stubs')
var SDK = require('@ama-team/voxengine-sdk')
var Level = SDK.Logger.Level
var Slf4j = SDK.Logger.Slf4j

describe('Acceptance', function () {
  describe('/index.js', function () {
    describe('.run()', function () {
      // TODO: remove those hooks
      beforeEach(function () {
        Stubs.install()
        Slf4j.setWriter(global.Logger)
        Slf4j.setLevel(Level.All)
      })
      afterEach(Stubs.uninstall)
      Fixture.versions().forEach(function (version) {
        describe('version ' + version, function () {
          Fixture.scenarios(version).forEach(function (id) {
            var scenario = Fixture.load(version, id)
            it('complies to scenario \'' + scenario.name + '\'', function () {
              return scenario.assert().then(function (value) {
                // added with the only purpose of placing breakpoints
                // in case promise leakage is suggested
                // also returns
                return value
              }, function (e) {
                throw e
              })
            })
          })
        })
      })
    })
  })
})
