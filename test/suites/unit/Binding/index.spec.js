/* eslint-env mocha */

var Chai = require('chai')
var expect = Chai.expect

var Binding = require('../../../../lib/Binding')
var TriggerType = require('../../../../lib/Schema/TriggerType').TriggerType

describe('Unit', function () {
  describe('/Binding', function () {
    describe('/index.js', function () {
      describe('.index', function () {
        describe('.trigger', function () {
          it('provides trigger type index', function () {
            var variants = [
              [TriggerType.Http, Binding.Started],
              [TriggerType.Call, Binding.CallAlerting]
            ]
            variants.forEach(function (variant) {
              expect(Binding.index.trigger[variant[0]]).to.eq(variant[1])
            })
          })
        })
      })
    })
  })
})
