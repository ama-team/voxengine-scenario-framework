/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Normalizer = require('../../../../lib/Schema/Normalizer').Normalizer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Normalizer.js', function () {
      describe('.Normalizer', function () {
        describe('.deserializer()', function () {
          it('replaces falsey value', function () {
            var input = false
            var result = Normalizer.deserializer(input, {})
            expect(result).to.have.property('handler').instanceOf(Function)
          })

          it('fills empty object', function () {
            var input = {}
            var result = Normalizer.deserializer(input, {})
            expect(result).to.have.property('handler').instanceOf(Function)
          })

          it('fills falsey $.handler property', function () {
            var input = {handler: false}
            var result = Normalizer.deserializer(input, {})
            expect(result).to.have.property('handler').instanceOf(Function)
          })

          it('wraps provided function', function () {
            var input = function () {}
            var result = Normalizer.deserializer(input, {})
            expect(result).to.have.property('handler').eq(input)
          })

          it('doesn\'t alternate correct structure', function () {
            var input = {
              handler: function () {}
            }
            var result = Normalizer.deserializer(input, {})
            expect(result).to.deep.eq(input)
          })
        })
      })
    })
  })
})
