/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

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
              transition: Normalizer.handler(null, 'transition', {}),
              abort: Normalizer.handler(null, 'abort', {}),
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
            var result = Normalizer.state([], id, {})
            expect(result.transition.handler).not.to.throw()
            expect(result.abort.handler).not.to.throw()
            expect(result.transition).not.to.have.property('onTimeout')
            expect(result.abort).not.to.have.property('onTimeout')
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

          it('normalizes function into state with transition handler', function () {
            var state = function () {}
            var timeout = 10
            var timeouts = {transition: timeout}
            var result = Normalizer.state(state, id, timeouts)
            expect(result).to.be.an('object')
            expect(result).to.have.property('id').eq(id)
            expect(result).to.have.property('transition').an('object')
            expect(result.transition).to.have.property('handler').eq(state)
            expect(result.transition).to.have.property('timeout').eq(timeout)
          })
        })
      })
    })
  })
})
