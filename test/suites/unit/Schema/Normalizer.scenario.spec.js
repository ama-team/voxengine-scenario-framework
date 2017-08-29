/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Normalizer = require('../../../../lib/Schema/Normalizer').Normalizer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Normalizer.js', function () {
      describe('.Normalizer', function () {
        describe('.scenario()', function () {
          it('throws on non-object input', function () {
            var lambda = function () {
              Normalizer.scenario(false)
            }
            expect(lambda).to.throw()
          })

          it('copies id, environment and version', function () {
            var input = {
              id: 'callback',
              environment: 'production',
              version: '0.1.2'
            }
            var scenario = Normalizer.scenario(input)

            expect(scenario).to.have.property('id').eq(input.id)
            expect(scenario).to.have.property('environment').eq(input.environment)
            expect(scenario).to.have.property('version').eq(input.version)
          })

          it('processes provided states', function () {
            var input = {
              states: {
                entrypoint: {
                  id: 'waffle'
                }
              }
            }

            var result = Normalizer.scenario(input)
            var state = result.states.entrypoint
            expect(state).to.have.property('transition')
            var handler = state.transition
            expect(handler).to.have.property('handler').instanceOf(Function)
          })

          it('uses provided onError handler', function () {
            var handler = function () {}
            var input = {
              onError: handler
            }

            var result = Normalizer.scenario(input)
            expect(result.onError).to.eq(handler)
          })

          it('creates dummy onError handler if missing', function () {
            var input = {}
            var result = Normalizer.scenario(input)
            expect(result).to.have.property('onError').instanceOf(Function)
            expect(result.onError).not.to.throw()
          })

          it('uses provided onTermination handler', function () {
            var handler = function () {}
            var input = {
              onTermination: handler
            }

            var result = Normalizer.scenario(input)
            expect(result.onTermination.handler).to.eq(handler)
          })

          it('creates dummy onTermination handler if missing', function () {
            var input = {}
            var result = Normalizer.scenario(input)
            expect(result).to.have.property('onTermination')
            var handler = result.onTermination
            expect(handler).to.have.property('handler').instanceOf(Function)
            expect(handler.handler).not.to.throw()
          })

          it('uses provided timeouts', function () {
            var timeout = 20
            var timeouts = {
              scenario: timeout,
              transition: timeout,
              onTransitionTimeout: timeout
            }
            var input = {
              timeouts: timeouts,
              states: {
                entrypoint: {}
              }
            }

            var result = Normalizer.scenario(input)
            expect(result.timeout).to.eq(timeout)
            var state = result.states.entrypoint
            expect(state.transition.timeout).to.eq(timeout)
            expect(state.transition.onTimeout.timeout).to.eq(timeout)
          })
        })
      })
    })
  })
})
