/* eslint-env mocha */
/* global VoxEngine */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

var Framework = require('../../../../lib/API/Framework').Framework
var Run = require('../../../../lib/Execution/Run').Run
var Status = require('../../../../lib/Schema/OperationStatus').OperationStatus
var TriggerType = require('../../../../lib/Schema').TriggerType

describe('Integration', function () {
  describe('/API', function () {
    describe('/Framework.js', function () {
      describe('.Framework', function () {
        var framework
        var scenario
        var result

        beforeEach(function () {
          framework = new Framework()
          scenario = {
            trigger: TriggerType.Http,
            states: {
              entrypoint: {
                transition: function () {},
                entrypoint: true
              },
              terminal: {
                transition: function () {},
                terminal: true
              }
            }
          }
          result = {
            status: Status.Finished,
            stages: {
              initialization: {
                status: Status.Finished
              },
              execution: {
                status: Status.Finished
              },
              termination: {
                status: Status.Finished
              }
            }
          }
        })

        describe('#prepare()', function () {
          it('throws an error on invalid scenario', function () {
            var lambda = framework.prepare.bind(framework, {})
            expect(lambda).to.throw()
          })

          it('returns a run otherwise', function () {
            expect(framework.prepare(scenario)).to.be.instanceOf(Run)
          })
        })

        describe('#execute()', function () {
          it('returns tripped result in case of unexpected error', function () {
            var error = new Error()
            var stub = Sinon.stub().returns(Promise.reject(error))
            var scenario = Sinon.stub().returns({})
            var run = {
              getCompletion: stub,
              getScenario: scenario,
              initialize: Sinon.stub()
            }
            return framework
              .execute(run)
              .then(function (result) {
                expect(result.status).to.eq(Status.Tripped)
                expect(result.error).to.eq(error)
              })
          })

          it('calls VoxEngine.terminate if options.behavior.terminate is set to true', function () {
            var run = {
              getCompletion: Sinon.stub().returns(Promise.resolve(result)),
              getScenario: Sinon.stub().returns({}),
              initialize: Sinon.stub()
            }
            var framework = new Framework({behavior: {terminate: true}})
            return framework
              .execute(run)
              .then(function () {
                expect(VoxEngine.terminate.callCount).to.eq(1)
              })
          })

          it('doesn\'t call VoxEngine.terminate if options.behavior.terminate is set to false', function () {
            var run = {
              getCompletion: Sinon.stub().returns(Promise.resolve(result)),
              getScenario: Sinon.stub().returns({}),
              initialize: Sinon.stub()
            }
            var framework = new Framework({behavior: {terminate: false}})
            return framework
              .execute(run)
              .then(function () {
                expect(VoxEngine.terminate.callCount).to.eq(0)
              })
          })
        })
      })
    })
  })
})
