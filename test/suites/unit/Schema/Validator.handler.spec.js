/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Validator = require('../../../../lib/Schema/Validator').Validator

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Validator.js', function () {
      describe('.Validator', function () {
        describe('.handler()', function () {
          var variants = {
            'falsey value': false,
            'function': function () {},
            '$.handler being a function': {handler: function () {}},
            '$.onTimeout being a function': {
              handler: function () {},
              onTimeout: function () {}
            },
            '$.onTimeout.handler being a function': {
              handler: function () {},
              onTimeout: {
                handler: function () {}
              }
            }
          }

          Object.keys(variants).forEach(function (key) {
            (function (key, value) {
              it('returns no violations for ' + key, function () {
                expect(Validator.handler(value).violations).to.be.empty
              })
            })(key, variants[key])
          })

          variants = {
            '$ is not a function / object': true,
            '$.handler is not a function': {handler: true},
            '$.onTimeout is not a function / object': {
              handler: function () {},
              onTimeout: true
            },
            '$.onTimeout.handler is not a function': {
              handler: function () {},
              onTimeout: {
                handler: true
              }
            }
          }

          Object.keys(variants).forEach(function (key) {
            (function (key, value) {
              it('returns fatal violation for ' + key, function () {
                var result = Validator.handler(value)
                expect(result.severity).to.eq(Validator.Severity.Fatal)
                expect(result.violations).not.to.be.empty
              })
            })(key, variants[key])
          })
        })
      })
    })
  })
})
