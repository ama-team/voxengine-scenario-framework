/* eslint-env mocha */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

var Run = require('../../../../lib/Execution/Run').Run
var Status = require('../../../../lib/Schema/OperationStatus').OperationStatus

describe('Integration', function () {
  describe('/Execution', function () {
    describe('/Run.js', function () {
      describe('.Run', function () {
        var handlerFactory = function (id, handler, onTimeout, timeout) {
          return {
            id: id,
            handler: Sinon.spy(handler || function () {}),
            timeout: timeout,
            onTimeout: {
              id: 'on' + id + 'timeout',
              handler: Sinon.spy(onTimeout || function () {}),
              timeout: timeout
            }
          }
        }

        var stateFactory = function (id, handler, onTimeout, entrypoint, terminal) {
          return {
            id: id,
            entrypoint: !!entrypoint,
            terminal: !!terminal,
            transition: handlerFactory('transition', handler, onTimeout),
            abort: handlerFactory('abort', handler, onTimeout)
          }
        }

        var scenarioFactory = function (states, onError, onTermination) {
          return {
            states: states,
            onError: onError,
            onTermination: onTermination
          }
        }

        var scenarioAutoFactory = function () {
          var states = {
            entrypoint: entrypointState,
            intermediate: intermediateState,
            terminal: terminalState
          }
          scenario = scenarioFactory(states, onError, onTermination)
          return scenario
        }

        var entrypointState
        var intermediateState
        var terminalState
        var onError
        var onTermination
        var scenario
        var deserializer
        var options
        var trigger = {arguments: ''}
        /**
         * @type Run
         */
        var run

        beforeEach(function () {
          entrypointState = stateFactory('entrypoint', function () {
            return 'intermediate'
          }, null, true)
          intermediateState = stateFactory('intermediate', function () {
            return 'terminal'
          })
          terminalState = stateFactory('terminal', null, null, false, true)
          onError = Sinon.stub()
          deserializer = {
            handler: Sinon.stub().returns({})
          }
          onTermination = handlerFactory('onTermination', function () {})
          options = {}
          scenarioAutoFactory()
        })

        var factory = function (scenario, deserializer, options) {
          return new Run(scenario, deserializer, options)
        }

        var autoFactory = function () {
          run = factory(scenarioAutoFactory(), deserializer, options)
          return run
        }

        it('tolerates no-options creation', function () {
          var lambda = function () {
            return new Run(scenario, deserializer)
          }
          expect(lambda).not.to.throw()
        })

        it('runs simple scenario', function () {
          var optionsInput = {x: 12}
          var triggerInput = {y: 13}
          options = {
            arguments: optionsInput,
            state: optionsInput
          }
          var trigger = {
            arguments: triggerInput,
            state: triggerInput
          }
          var logUrl = 'fake://url'
          autoFactory()
          var promise = run.initialize()
          run.proceed(trigger)
          run.setLog(logUrl)
          return promise
            .then(function (result) {
              expect(result.status).to.eq(Status.Finished)
              expect(result.stages.initialization.status).to.eq(Status.Finished)
              expect(result.stages.scenario.status).to.eq(Status.Finished)
              expect(result.stages.termination.status).to.eq(Status.Finished)
            })
        })

        it('results in failed state if one stage has failed', function () {
          var error = new Error()
          onTermination.handler = function () {
            throw error
          }
          autoFactory()
          run.initialize()
          return run
            .proceed(trigger)
            .then(function (result) {
              expect(result.status).to.eq(Status.Failed)
              expect(result.stages.initialization.status).to.eq(Status.Finished)
              expect(result.stages.scenario.status).to.eq(Status.Finished)
              expect(result.stages.termination.status).to.eq(Status.Failed)
            })
        })

        it('doesn\'t run scenario stage if initialization has failed', function () {
          var error = new Error()
          deserializer.handler.throws(error)
          autoFactory()
          return run
            .execute({})
            .then(function (result) {
              expect(result.status).to.eq(Status.Failed)
              expect(result.stages.initialization.status).to.eq(Status.Failed)
              expect(result.stages.scenario).to.eq(null)
              expect(entrypointState.transition.handler.callCount).to.eq(0)
              expect(result.stages.termination.status).to.eq(Status.Finished)
            })
        })
      })
    })
  })
})
