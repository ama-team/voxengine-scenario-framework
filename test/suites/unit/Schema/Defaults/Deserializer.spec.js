/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Deserializer = require('../../../../../lib/Schema/Defaults').Deserializer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Defaults', function () {
      describe('/Deserializer.js', function () {
        it('returns empty object for falsey value', function () {
          expect(Deserializer(false)).to.deep.eq({})
        })

        it('returns empty object for empty string', function () {
          expect(Deserializer('')).to.deep.eq({})
        })

        it('parses invalid json as customData object', function () {
          var input = '{"beginning":'
          expect(Deserializer(input)).to.deep.eq({customData: input})
        })

        it('parses valid json as it\'s contents', function () {
          var input = {x: 12}
          expect(Deserializer(JSON.stringify(input))).to.deep.eq(input)
        })
      })
    })
  })
})
