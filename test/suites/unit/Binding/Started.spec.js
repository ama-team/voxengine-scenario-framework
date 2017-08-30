/* eslint-env mocha */
/* global VoxEngine, AppEvents */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

var Started = require('../../../../lib/Binding/Started').Started
var TriggerType = require('../../../../lib/Schema/TriggerType').TriggerType

describe('Unit', function () {
  describe('/Binding', function () {
    describe('/Started.js', function () {
      describe('.Started', function () {
        var stash = {}

        beforeEach(function () {
          stash.VoxEngine = global.VoxEngine
          global.VoxEngine = {
            customData: Sinon.stub()
          }
          stash.AppEvents = global.AppEvents
          global.AppEvents = {
            Started: {name: 'Started'}
          }
        })

        afterEach(function () {
          global.VoxEngine = stash.VoxEngine
          global.AppEvents = stash.AppEvents
        })

        describe('.extractTrigger', function () {
          it('returns expected value', function () {
            var args = '{"id": 124}'
            VoxEngine.customData.returns(args)
            var event = {}
            var expectation = {
              type: TriggerType.Http,
              arguments: args,
              call: null,
              event: event
            }
            expect(Started.extractTrigger(event)).to.deep.eq(expectation)
          })
        })

        describe('.getTriggerType', function () {
          it('commits to nearly-100% coverage', function () {
            expect(Started.getTriggerType()).to.eq(TriggerType.Http)
          })
        })

        describe('.getEventType', function () {
          it('commits to nearly-100% coverage', function () {
            expect(Started.getEventType()).to.eq(global.AppEvents.Started)
          })
        })
      })
    })
  })
})
