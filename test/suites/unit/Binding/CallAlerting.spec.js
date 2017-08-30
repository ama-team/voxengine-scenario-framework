/* eslint-env mocha */
/* global AppEvents */

var Chai = require('chai')
var expect = Chai.expect

var CallAlerting = require('../../../../lib/Binding/CallAlerting').CallAlerting
var TriggerType = require('../../../../lib/Schema/TriggerType').TriggerType

describe('Unit', function () {
  describe('/Binding', function () {
    describe('/CallAlerting.js', function () {
      describe('.CallAlerting', function () {
        describe('.extractTrigger', function () {
          var stash

          beforeEach(function () {
            stash = global.AppEvents
            global.AppEvents = {
              CallAlerting: {name: 'CallAlerting'}
            }
          })

          afterEach(function () {
            global.AppEvents = stash
          })

          it('returns expected value', function () {
            var args = '{"id": 124}'
            var call = {hello: 'yes this is dog'}
            var event = {
              call: call,
              customData: args
            }
            var expectation = {
              type: TriggerType.Call,
              arguments: args,
              call: call,
              event: event
            }
            expect(CallAlerting.extractTrigger(event)).to.deep.eq(expectation)
          })
        })

        describe('.getTriggerType', function () {
          it('commits to nearly-100% coverage', function () {
            expect(CallAlerting.getTriggerType()).to.eq(TriggerType.Call)
          })
        })

        describe('.getEventType', function () {
          it('commits to nearly-100% coverage', function () {
            expect(CallAlerting.getEventType()).to.eq(global.AppEvents.CallAlerting)
          })
        })
      })
    })
  })
})
