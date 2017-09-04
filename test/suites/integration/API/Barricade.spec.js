/* eslint-env mocha */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

var Barricade = require('../../../../lib/API/Barricade').Barricade
var Errors = require('../../../../lib/Error')
var Schema = require('../../../../lib/Schema')
var TriggerType = Schema.TriggerType
var Validator = Schema.Validator

describe('Integration', function () {
  describe('/API', function () {
    describe('/Barricade.js', function () {
      describe('.Barricade', function () {
        var scenario
        beforeEach(function () {
          scenario = {
            trigger: TriggerType.Http,
            states: {
              entrypoint: {
                transition: function () {},
                entrypoint: true
              },
              terminal: {
                transition: function () {},
                terminal: true
              }
            }
          }
        })

        it('uses provided printer', function () {
          var printer = {violations: Sinon.stub()}
          var options = {printer: printer}
          var lambda = function () {
            return (new Barricade(options)).scenario(scenario)
          }
          expect(lambda).not.to.throw()
          expect(printer.violations.callCount).to.eq(1)
          expect(printer.violations.getCall(0).args[0]).to.be.instanceOf(Validator.ViolationSet)
        })

        it('returns normalized scenario if input is valid', function () {
          var normalized = (new Barricade()).scenario(scenario)
          expect(normalized).to.have.property('onError')
          expect(normalized.onError).to.have.property('handler').instanceOf(Function)
        })

        it('throws error on invalid input', function () {
          var barricade = new Barricade()
          var lambda = barricade.scenario.bind(barricade, {})
          expect(lambda).to.throw(Errors.InvalidInputError)
        })
      })
    })
  })
})
