/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Deserializer = require('../../../../../lib/Schema/Defaults').Deserializer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Defaults', function () {
      describe('/Deserializer.js', function () {
        describe('.factory()', function () {
          var deserializer
          beforeEach(function () {
            deserializer = Deserializer.factory()
          })

          it('returns empty object for falsey value', function () {
            expect(deserializer(false)).to.deep.eq({})
          })

          it('returns empty object for empty string', function () {
            expect(deserializer('')).to.deep.eq({})
          })

          it('parses invalid json as customData object', function () {
            var input = '{"beginning":'
            expect(deserializer(input)).to.deep.eq({customData: input})
          })

          it('parses valid json as it\'s contents', function () {
            var input = {x: 12}
            expect(deserializer(JSON.stringify(input))).to.deep.eq(input)
          })
        })
      })
    })
  })
})
