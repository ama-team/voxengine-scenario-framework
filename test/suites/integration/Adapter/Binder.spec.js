/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
/* global AppEvents, VoxEngine */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

var TriggerType = require('../../../../lib/Schema').TriggerType

var Binder = require('../../../../lib/Adapter/Binder').Binder

describe('Integration', function () {
  describe('/Adapter', function () {
    describe('/Binder.js', function () {
      describe('.Binder', function () {
        var customData
        var call
        var logURL
        var run
        var scenario

        beforeEach(function () {
          customData = JSON.stringify({parameter: 'value'})
          call = {customData: customData}
          logURL = 'fake://path'
          scenario = {
            trigger: null
          }
          run = {
            getScenario: Sinon.stub().returns(scenario),
            setLog: Sinon.stub(),
            proceed: Sinon.stub()
          }
        })

        describe('.startedListener', function () {
          it('only sets log url for Call scenario', function () {
            var event = new AppEvents.Started({logURL: logURL})
            scenario.trigger = TriggerType.Call
            Binder.startedListener(run, event)
            expect(run.setLog.callCount).to.eq(1)
            expect(run.proceed.callCount).to.eq(0)
          })

          it('computes expected trigger for Http scenario', function () {
            var event = new AppEvents.Started({logURL: logURL})
            VoxEngine.customData(customData)
            var expectation = {
              event: event,
              call: null,
              arguments: customData,
              type: TriggerType.Http
            }
            scenario.trigger = TriggerType.Http
            Binder.startedListener(run, event)
            expect(run.proceed.callCount).to.eq(1)
            expect(run.proceed.getCall(0).args[0]).to.deep.eq(expectation)
          })
        })

        describe('.callAlertingListener', function () {
          it('does nothing for Http scenario', function () {
            var event = new AppEvents.CallAlerting({call: call})
            scenario.trigger = TriggerType.Http
            Binder.callAlertingListener(run, event)
            expect(run.proceed.callCount).to.eq(0)
          })

          it('computes expected trigger for Call scenario', function () {
            var event = new AppEvents.CallAlerting({call: call})
            var expectation = {
              event: event,
              call: call,
              arguments: customData,
              type: TriggerType.Call
            }
            scenario.trigger = TriggerType.Call
            Binder.callAlertingListener(run, event)
            expect(run.proceed.callCount).to.eq(1)
            expect(run.proceed.getCall(0).args[0]).to.deep.eq(expectation)
          })
        })
      })
    })
  })
})
