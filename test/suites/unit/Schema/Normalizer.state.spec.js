/* eslint-env mocha */

var Chai = require('chai')
var expect = Chai.expect

var Normalizer = require('../../../../lib/Schema/Normalizer').Normalizer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Normalizer.js', function () {
      describe('.Normalizer', function () {
        describe('.state()', function () {
          var id = 'entrypoint'

          it('doesn\'t touch complete structure', function () {
            var state = {
              id: id,
              entrypoint: true,
              terminal: false,
              transition: Normalizer.stateHandler(null, 'transition', {}),
              abort: Normalizer.stateHandler(null, 'abort', {}),
              timeout: 10,
              triggers: {
                id: 'terminal',
                hints: {}
              }
            }

            expect(Normalizer.state(state, id, {})).to.deep.eq(state)
          })

          it('replaces non-string id', function () {
            var state = {id: false}

            expect(Normalizer.state(state, id, {})).to.have.property('id').eq(id)
          })

          it('sets missing terminal and entrypoint properties', function () {
            var state = {}

            var result = Normalizer.state(state, id, {})
            expect(result).to.have.property('terminal').false
            expect(result).to.have.property('entrypoint').false
          })

          it('sets missing timeout', function () {
            var timeout = 10
            var state = {}
            var timeouts = {state: timeout}

            var result = Normalizer.state(state, id, timeouts)
            expect(result).to.have.property('timeout').eq(timeout)
          })

          it('provides default handler implementations', function () {
            var error = new Error()
            var result = Normalizer.state({}, id, {})
            expect(result.transition.handler).not.to.throw()
            expect(result.abort.handler).not.to.throw()

            var lambda = function () {
              result.transition.onTimeout.handler(null, null, null, error)
            }
            expect(lambda).to.throw(error)

            lambda = function () {
              result.abort.onTimeout.handler(null, null, null, error)
            }
            expect(lambda).to.throw(error)
          })

          it('sets missing `.triggers` property to null', function () {
            var state = {}
            var result = Normalizer.state(state, id, {})
            expect(result).to.have.property('triggers').to.be.null
          })

          it('normalizes provided `.triggers` property', function () {
            var state = {
              triggers: 'terminal'
            }
            var result = Normalizer.state(state, id, {})
            expect(result).to.have.property('triggers')
            var triggers = result.triggers
            expect(triggers).to.have.property('id').eq(state.triggers)
            expect(triggers).to.have.property('hints').deep.eq({})
          })
        })
      })
    })
  })
})
