/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Validator = require('../../../../lib/Schema/Validator').Validator

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Validator.js', function () {
      describe('.Validator', function () {
        describe('.state()', function () {
          it('reports fatal violation if falsey value is passed', function () {
            var result = Validator.state(null)
            expect(result.severity).to.eq(Validator.Severity.Fatal)
            expect(result.violations).to.have.property('$').not.empty
          })

          it('reports fatal violation if transition handler is missing', function () {
            var input = {abort: function () {}}
            var result = Validator.state(input)
            expect(result.severity).to.eq(Validator.Severity.Fatal)
            expect(result.violations).to.have.property('$.transition').not.empty
          })

          it('reports fatal violation if transition handler is nor valid', function () {
            var input = {transition: true, abort: function () {}}
            var result = Validator.state(input)
            expect(result.severity).to.eq(Validator.Severity.Fatal)
            expect(result.violations).to.have.property('$.transition').not.empty
          })

          it('reports minor violation if abort handler is missing', function () {
            var input = {transition: function () {}}
            var result = Validator.state(input)
            expect(result.severity).to.eq(Validator.Severity.Minor)
            expect(result.violations).to.have.property('$.abort').not.empty
          })

          it('reports fatal violation if abort handler is not valid', function () {
            var input = {transition: function () {}, abort: true}
            var result = Validator.state(input)
            expect(result.severity).to.eq(Validator.Severity.Fatal)
            expect(result.violations).to.have.property('$.abort').not.empty
          })

          it('reports no violations if handlers are correct', function () {
            var input = {
              transition: function () {},
              abort: function () {}
            }
            expect(Validator.state(input).violations).to.be.empty
          })
        })
      })
    })
  })
})
