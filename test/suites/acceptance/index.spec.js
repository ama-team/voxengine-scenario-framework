/* eslint-env mocha */

var Fixture = require('../../support/Fixture/Scenario').Scenario

describe('Acceptance', function () {
  describe('/index.js', function () {
    describe('.run()', function () {
      Fixture.versions().forEach(function (version) {
        describe('version ' + version + ' scenario completes as asserted', function () {
          Fixture.scenarios(version).forEach(function (id) {
            var scenario = Fixture.load(version, id)
            it(scenario.name, function () {
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
