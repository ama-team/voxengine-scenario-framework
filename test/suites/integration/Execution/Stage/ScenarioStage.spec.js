/* eslint-env mocha */

var Chai = require('chai')
var expect = Chai.expect

var ScenarioStage = require('../../../../../lib/Execution/Stage/ScenarioStage').ScenarioStage
var Executor = require('../../../../../lib/Execution/Executor').Executor
var StateMachine = require('../../../../../lib/Execution/StateMachine').StateMachine
var Status = require('../../../../../lib/Schema/OperationStatus').OperationStatus

describe('Integration', function () {
  describe('/Execution', function () {
    describe('/Stage', function () {
      describe('/ScenarioStage', function () {
        describe('.ScenarioStage', function () {
          var scenario
          var executor
          var context

          beforeEach(function () {
            context = {}
            executor = new Executor(context)
            scenario = {
              states: {
                entrypoint: {
                  entrypoint: true,
                  terminal: true,
                  transition: {
                    handler: function () {}
                  }
                }
              }
            }
          })

          var autoFactory = function () {
            return new ScenarioStage(executor, scenario, {})
          }

          describe('< new', function () {
            it('tolerates missing settings', function () {
              var lambda = function () {
                return new ScenarioStage(executor, scenario)
              }
              expect(lambda).not.to.throw()
            })
          })

          describe('#getStateMachine()', function () {
            it('provides access to state machine', function () {
              expect(autoFactory().getStateMachine()).to.be.instanceOf(StateMachine)
            })
          })

          describe('#run()', function () {
            it('runs as expected', function () {
              var stage = autoFactory()
              return stage
                .run()
                .then(function (result) {
                  expect(result.status).to.eq(Status.Finished)
                })
            })

            it('catches unexpected error', function () {
              var stage = autoFactory()
              var error = new Error()
              stage.getStateMachine().run = function () {
                return Promise.reject(error)
              }
              return stage
                .run()
                .then(function (result) {
                  expect(result.status).to.eq(Status.Tripped)
                  expect(result.value).to.eq(error)
                })
            })
          })
        })
      })
    })
  })
})
