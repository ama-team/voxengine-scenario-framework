/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

/*
 * This suite differs from the very same integration suites by the fact
 * it is populated with backpropagated rela examples that failed during
 * executions
 */

var Chai = require('chai')
var expect = Chai.expect

var Normalizer = require('../../../../lib/Schema/Normalizer').Normalizer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Normalizer.js', function () {
      describe('.Normalizer', function () {
        describe('.scenario()', function () {
          it('creates deserializer handler from function', function () {
            var input = {
              states: {},
              deserializer: function (input) {
                return JSON.parse(input)
              }
            }
            var result = Normalizer.scenario(input)
            expect(result.deserializer).to.be.an('object')
            expect(result.deserializer.handler).to.eq(input.deserializer)
          })
        })
      })
    })
  })
})
