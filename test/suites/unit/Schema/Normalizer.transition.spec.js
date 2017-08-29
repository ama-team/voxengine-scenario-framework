/* eslint-env mocha */

var Chai = require('chai')
var expect = Chai.expect

var Normalizer = require('../../../../lib/Schema/Normalizer').Normalizer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Normalizer.js', function () {
      describe('.Normalizer', function () {
        describe('.transition()', function () {
          it('accepts garbage', function () {
            expect(Normalizer.transition(false)).to.be.instanceOf(Object)
          })

          it('creates missing trigger', function () {
            expect(Normalizer.transition({})).to.have.property('trigger').null
          })

          it('replaces invalid trigger with null', function () {
            var input = {trigger: 123}
            expect(Normalizer.transition(input)).to.have.property('trigger').null
          })

          it('doesn\'t change filled trigger', function () {
            var input = {trigger: {id: 'terminal', hints: {x: 12}}}
            var result = Normalizer.transition(input)

            expect(result).to.have.property('trigger').deep.eq(input.trigger)
          })

          it('converts string trigger to full trigger', function () {
            var input = {trigger: 'terminal'}
            var result = Normalizer.transition(input)

            expect(result).to.have.property('trigger')
            var trigger = result.trigger
            expect(trigger).to.have.property('id', input.trigger)
          })

          it('converts string to trigger', function () {
            var input = 'terminal'
            var result = Normalizer.transition(input)

            expect(result).to.have.property('trigger')
            var trigger = result.trigger
            expect(trigger).to.have.property('id').eq(input)
          })

          it('creates missing hints', function () {
            var input = {trigger: {id: 'terminal'}}
            var result = Normalizer.transition(input)

            expect(result).to.have.property('trigger')
            var trigger = result.trigger
            expect(trigger).to.have.property('hints').deep.eq({})
          })

          it('creates empty `.transitionedTo` if absent', function () {
            var input = {}
            var result = Normalizer.transition(input)
            expect(result).to.have.property('transitionedTo').null
          })

          it('truncates non-string `.transitionedTo`', function () {
            var input = {transitionedTo: 123}
            var value = Normalizer.transition(input);
            expect(value).to.have.property('transitionedTo', null)
          })

          it('keeps string `.transitionedTo`', function () {
            var input = {transitionedTo: 'entrypoint'}
            var value = Normalizer.transition(input);
            expect(value).to.have.property('transitionedTo').eq(input.transitionedTo)
          })
        })
      })
    })
  })
})
