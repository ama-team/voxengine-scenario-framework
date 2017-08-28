/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var SDK = require('@ama-team/voxengine-sdk')
var TimeoutException = SDK.Concurrent.TimeoutException

var OperationStatus = require('../../../../lib/Schema').OperationStatus
var Execution = require('../../../../lib/Execution/Execution').Execution
var Errors = require('../../../../lib/Error')

describe('Integration', function () {
  describe('/Execution', function () {
    describe('/Execution.js', function () {
      describe('.Execution', function () {
        var scenario
        var entrypoint
        var entrypointHandler
        var terminal
        var terminalHandler
        var errorHandler
        var terminationHandler
        var terminationTimeoutHandler

        beforeEach(function () {
          entrypointHandler = function (_, hints) {
            return {trigger: {id: 'terminal', hints: hints}}
          }
          terminationHandler = function () {}
          terminationTimeoutHandler = function (_, error) { throw error }
        })

        var handlerFactory = function (id, handler, timeout, timeoutHandler) {
          handler = handler || function () {}
          timeoutHandler = timeoutHandler || function (a, b, c, error) {
            throw error
          }
          return {
            id: id,
            handler: Sinon.spy(handler),
            timeout: timeout,
            timeoutHandler: {
              id: 'on' + id[0].toUpperCase() + id.substr(1) + 'Timeout',
              handler: Sinon.spy(timeoutHandler),
              timeout: timeout
            }
          }
        }

        var stateFactory = function (id, handler, timeout) {
          return {
            id: id,
            transition: handlerFactory('transition', handler, timeout),
            abort: handlerFactory('abort', handler, timeout),
            entrypoint: false,
            terminal: false
          }
        }

        var factory = function (scenario, options) {
          return new Execution(scenario, options)
        }

        var scenarioAutoFactory = function () {
          entrypoint = stateFactory('entrypoint', entrypointHandler)
          entrypoint.entrypoint = true
          terminal = stateFactory('terminal', terminalHandler)
          terminal.terminal = true

          scenario = {
            states: {
              terminal: terminal,
              entrypoint: entrypoint
            },
            errorHandler: errorHandler,
            terminationHandler: handlerFactory(
              'termination',
              terminationHandler,
              null,
              terminationTimeoutHandler
            )
          }
          return scenario
        }

        var autoFactory = function () {
          return factory(scenarioAutoFactory())
        }

        describe('#run()', function () {
          it('runs states and termination handler', function () {
            var execution = autoFactory()
            var hints = {x: 12}
            return execution
              .run(hints)
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Finished)
                var handlers = [
                  entrypoint.transition.handler,
                  terminal.transition.handler
                ]
                handlers.forEach(function (handler) {
                  expect(handler.callCount).to.eq(1)
                  expect(handler.getCall(0).args[1]).to.eq(hints)
                })
                expect(scenario.terminationHandler.handler.callCount).to.eq(1)
              })
          })

          it('uses context args if none provided', function () {
            var args = {x: 12}
            var execution = factory(scenarioAutoFactory(), {arguments: args})
            return execution
              .run()
              .then(function () {
                var handlers = [
                  entrypoint.transition.handler,
                  terminal.transition.handler
                ]
                handlers.forEach(function (handler) {
                  expect(handler.callCount).to.eq(1)
                  expect(handler.getCall(0).args[1]).to.eq(args)
                })
              })
          })

          it('throws if called twice', function () {
            var execution = autoFactory()
            var lambda = function () {
              execution.run()
            }
            expect(lambda).not.to.throw()
            expect(lambda).to.throw(Errors.InternalError)
          })

          it('timeouts too long scenario', function () {
            scenarioAutoFactory()
            scenario.timeout = 0
            var execution = factory(scenario)
            return execution
              .run()
              .then(function (result) {
                expect(result.scenario.status).to.eq(OperationStatus.Failed)
                expect(result.scenario.value).to.be.instanceOf(TimeoutException)
              })
          })
        })

        describe('#getRunningTime()', function () {
          it('returns null if not started', function () {
            var execution = autoFactory()
            expect(execution.getRunningTime()).to.be.null
          })

          it('returns elapsed time if not finished', function () {
            entrypointHandler = function () {
              return new Promise(function () {})
            }
            var execution = autoFactory()
            var launchedAt = new Date()
            execution.run()
            var wall = new Date()
            var time = execution.getRunningTime()
            var difference = wall.getTime() - launchedAt.getTime()
            expect(time).to.be.at.least(0)
            expect(time).to.be.at.most(difference)
          })

          it('returns full time if finished', function () {
            var execution = autoFactory()
            var launchedAt = new Date()
            execution.run()
            var finishedAt = new Date()
            var difference = finishedAt.getTime() - launchedAt.getTime()
            var time = execution.getRunningTime()
            expect(time).to.be.at.least(0)
            expect(time).to.be.at.most(difference)
          })
        })

        describe('#getState()', function () {
          it('returns null if not reached any state', function () {
            var execution = autoFactory()
            expect(execution.getState()).to.be.null
          })

          it('returns state id for reached state', function () {
            var execution = autoFactory()
            return execution
              .run()
              .then(function () {
                expect(execution.getState()).to.eq(terminal.id)
              })
          })
        })

        describe('#getTransition()', function () {
          it('returns null if not started', function () {
            var execution = autoFactory()
            expect(execution.getTransition()).to.be.null
          })

          it('returns null if reached non-triggering state', function () {
            var execution = autoFactory()
            return execution
              .run()
              .then(function () {
                expect(execution.getTransition()).to.be.null
              })
          })

          it('returns transition details if caught in the middle', function () {
            entrypointHandler = function () {
              return new Promise(function () {})
            }
            var hints = {x: 12}
            var execution = autoFactory()
            execution.run(hints)
            var transition = execution.getTransition()
            expect(transition).not.to.be.null
            expect(transition.origin).to.be.null
            expect(transition.target).to.eq(entrypoint.id)
            expect(transition.hints).to.eq(hints)
          })
        })
      })
    })
  })
})
