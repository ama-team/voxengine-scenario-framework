/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Validator = require('../../../../lib/Schema/Validator').Validator
var Severity = Validator.Severity

var worstViolation = function (violations) {
  return violations.reduce(function (carrier, violation) {
    return ((carrier && carrier.weight) || 0) >= violation.weight ? carrier : violation
  }, null)
}

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Validator.js', function () {
      describe('.Validator', function () {
        describe('.state()', function () {
          it('doesn\'t produce any violations for valid definition', function () {
            var input = {
              transition: function () {},
              abort: function () {},
              entrypoint: true,
              terminal: false,
              timeout: null
            }
            var violations = Validator.state(input)
            expect(violations.violations).to.be.empty
          })

          it('reports illegal value', function () {
            var violations = Validator.state(false)
            expect(violations.severity).to.eq(Severity.Fatal)
          })

          it('reports missing $.transition handler', function () {
            var violations = Validator.state({})
            violations = violations.violations['$.transition']
            expect(violations).not.to.be.empty
          })

          it('reports missing $.abort handler', function () {
            var violations = Validator.state({})
            violations = violations.violations['$.abort']
            expect(violations).not.to.be.empty
          })
        })

        describe('.scenario()', function () {
          var scenario

          beforeEach(function () {
            scenario = {
              id: 'callback',
              version: '0.1.2',
              environment: 'environment',
              states: {
                entrypoint: {
                  transition: function () {},
                  abort: function () {},
                  entrypoint: true,
                  terminal: false
                },
                terminal: {
                  transition: function () {},
                  abort: function () {},
                  entrypoint: false,
                  terminal: true
                }
              },
              onError: function () {},
              onTermination: function () {}
            }
          })

          it('doesn\'t report anything on reference scenario', function () {
            var violations = Validator.scenario(scenario)
            expect(violations.severity).to.eq(Severity.None)
            expect(violations.violations).to.be.empty
          })

          it('reports illegal input', function () {
            var violations = Validator.scenario(false)
            expect(violations.severity).to.eq(Severity.Fatal)
          })

          it('reports missing $.onTermination handler', function () {
            delete scenario.onTermination
            var violations = Validator.scenario(scenario)
            violations = violations.violations['$.onTermination']
            expect(violations).not.to.be.empty
          })

          it('reports missing $.onError handler', function () {
            delete scenario.onError
            var violations = Validator.scenario(scenario)
            violations = violations.violations['$.onError']
            expect(violations).not.to.be.empty
          })

          it('reports illegal states input', function () {
            scenario.states = false
            var violations = Validator.scenario(scenario).violations['$.states']
            expect(violations).not.to.be.empty
            var violation = worstViolation(violations)
            expect(violation).to.have.property('severity').eq(Severity.Fatal)
          })

          it('reports multiple entrypoint states', function () {
            scenario.states.terminal.entrypoint = true
            var violations = Validator.scenario(scenario).violations['$.states']
            expect(violations).to.have.lengthOf(1)
            expect(violations[0]).to.have.property('severity').eq(Severity.Fatal)
          })

          it('reports zero entrypoint states', function () {
            scenario.states.entrypoint.entrypoint = false
            var violations = Validator.scenario(scenario).violations['$.states']
            expect(violations).to.have.lengthOf(1)
            expect(violations[0]).to.have.property('severity').eq(Severity.Fatal)
          })

          it('reports missing terminal states', function () {
            scenario.states.terminal.terminal = false
            var violations = Validator.scenario(scenario).violations['$.states']
            expect(violations).to.have.lengthOf(1)
            expect(violations[0]).to.have.property('severity').eq(Severity.Fatal)
          })

          it('incorporates invalid state violations', function () {
            scenario.states.entrypoint = null
            var violations = Validator.scenario(scenario)
            violations = violations.violations['$.states.entrypoint']
            expect(violations).not.to.be.empty
          })
        })
      })
    })
  })
})
