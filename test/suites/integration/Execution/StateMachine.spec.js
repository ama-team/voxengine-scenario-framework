/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var SDK = require('@ama-team/voxengine-sdk')
var Future = SDK.Concurrent.Future

var SimpleExecutor = require('../../../support/SimpleExecutor').SimpleExecutor
var StateMachine = require('../../../../lib/Execution').StateMachine
var Status = require('../../../../lib/Schema').OperationStatus
var Errors = require('../../../../lib/Error')

describe('Integration', function () {
  describe('/Execution', function () {
    describe('/StateMachine.js', function () {
      describe('.StateMachine', function () {
        var context = {}
        var executor = new SimpleExecutor(context)

        var entrypointState
        var terminalState
        var redirectingState
        var erroneousState
        var timingOutState
        var infiniteState

        var scenario

        var errorHandler

        var handlerFactory = function (handler, timeout, name) {
          return {
            name: name || 'stub',
            timeout: timeout || null,
            handler: Sinon.spy(handler || function () {})
          }
        }

        var stateFactory = function (id, handler, terminal, timeout) {
          var state = {
            id: id,
            entrypoint: false,
            terminal: !!terminal
          }
          var handlers = ['transition', 'onTransitionTimeout', 'abort', 'onAbortTimeout']
          handlers.forEach(function (name) {
            state[name] = handlerFactory(handler, timeout, name)
          })
          return state
        }

        var scenarioFactory = function () {
          entrypointState.entrypoint = true
          var states = [
            entrypointState,
            terminalState,
            redirectingState,
            erroneousState,
            timingOutState,
            infiniteState
          ]
          scenario = {}
          states.forEach(function (state) {
            scenario[state.id] = state
          })
          return scenario
        }

        beforeEach(function () {
          terminalState = stateFactory('terminal', function () {}, true)
          entrypointState = stateFactory('entrypoint', function () {
            return {trigger: {id: 'terminal'}}
          })
          redirectingState = stateFactory('redirect', function (_, hints) {
            return {trigger: hints.trigger}
          })
          erroneousState = stateFactory('error', function () {
            throw new Error()
          })
          timingOutState = stateFactory('timeout', function () {
            return new Promise(function () {})
          }, false, 0)
          infiniteState = stateFactory('infinite', function () {
            return new Promise(function () {})
          })
          errorHandler = Sinon.spy(function () {})
          scenario = scenarioFactory()
        })

        var factory = function (scenario, errorHandler) {
          return new StateMachine(executor, scenario, errorHandler)
        }

        var autoFactory = function () {
          return factory(scenarioFactory(), errorHandler)
        }

        describe('< new', function () {
          it('fails if entrypoint state is not provided', function () {
            var lambda = function () {
              return new StateMachine(executor, {infinite: infiniteState})
            }
            expect(lambda).to.throw(Errors.ScenarioError)
          })
        })

        describe('#run()', function () {
          it('ends if terminal state is reached', function () {
            entrypointState.terminal = true
            var machine = autoFactory()
            return machine
              .run()
              .then(function () {
                var entrypoint = entrypointState.transition.handler
                expect(entrypoint.callCount).to.eq(1)
              })
          })

          it('triggers error handler in case error has been thrown', function () {
            var error = {error: 'imma mighty errro woooooo'}
            entrypointState.transition.handler = Sinon.spy(function () {
              throw error
            })
            var hints = {x: 12}
            var machine = autoFactory()
            return machine
              .run(hints)
              .then(function (result) {
                expect(result.status).to.eq(Status.Failed)
                expect(result.value).to.eq(error)
                expect(errorHandler.callCount).to.eq(1)
                var args = errorHandler.getCall(0).args
                expect(args[0]).to.eq(error)
                expect(args[1]).to.eq(null)
                expect(args[2]).to.eq(entrypointState.id)
                expect(args[3]).to.eq(hints)
              })
          })

          it('tolerates error handler failure', function () {
            var error = {x: 'fake error'}
            entrypointState.transition.handler = Sinon.spy(function () {
              throw error
            })
            errorHandler = Sinon.spy(function () {
              throw new Error()
            })
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Failed)
                expect(result.value).to.eq(error)
                expect(errorHandler.callCount).to.eq(1)
              })
          })

          it('triggers next state if `.trigger.id` is present in return value', function () {
            var hints = {x: 12}
            entrypointState.transition.handler = function () {
              return {trigger: {id: 'terminal', hints: hints}}
            }
            terminalState.transition.handler = Sinon.spy(function () {})
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                var handler = terminalState.transition.handler
                expect(handler.callCount).to.eq(1)
                expect(handler.getCall(0).args[0]).to.eq(entrypointState.id)
                expect(handler.getCall(0).args[1]).to.eq(hints)
              })
          })

          it('calls `.trigger.hints` in result if it is a function', function () {
            var hints = {x: 12}
            var wrapper = Sinon.spy(function () { return hints })
            entrypointState.transition.handler = function () {}
            entrypointState.triggers = {id: 'terminal', hints: wrapper}
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                var handler = terminalState.transition.handler
                expect(handler.callCount).to.eq(1)
                expect(handler.getCall(0).args[0]).to.eq(entrypointState.id)
                expect(handler.getCall(0).args[1]).to.eq(hints)
                expect(wrapper.callCount).to.eq(1)
              })
          })

          it('triggers next state if `.triggers` property is set', function () {
            var hints = {x: 12}
            entrypointState.transition.handler = function () {}
            entrypointState.triggers = {id: 'terminal', hints: hints}
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                var handler = terminalState.transition.handler
                expect(handler.callCount).to.eq(1)
                expect(handler.getCall(0).args[0]).to.eq(entrypointState.id)
                expect(handler.getCall(0).args[1]).to.eq(hints)
              })
          })

          it('calls `.triggers.hints` state property if it is a function', function () {
            var hints = {x: 12}
            var wrapper = Sinon.spy(function () { return hints })
            entrypointState.transition.handler = function () {}
            entrypointState.triggers = {id: 'terminal', hints: wrapper}
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                var handler = terminalState.transition.handler
                expect(handler.callCount).to.eq(1)
                expect(handler.getCall(0).args[0]).to.eq(entrypointState.id)
                expect(handler.getCall(0).args[1]).to.eq(hints)
                expect(wrapper.callCount).to.eq(1)
              })
          })

          it('reads `.transitionedTo` result property', function () {
            entrypointState.transition.handler = function () {
              return {transitionedTo: 'terminal'}
            }
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                expect(machine.getState()).to.eq(terminalState)
              })
          })

          it('terminates with error if `.transitionedTo` specifies nonexistent state', function () {
            entrypointState.transition.handler = function () {
              return {transitionedTo: 'nonexistent'}
            }
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Failed)
                expect(result.value).to.be.instanceOf(Errors.ScenarioError)
              })
          })

          it('terminates with Tripped status if internal error has been ecnountered', function () {
            var error = new Errors.InternalError()
            entrypointState.transition.handler = function () {
              throw error
            }
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Tripped)
                expect(result.value).to.eq(error)
              })
          })

          it('has default error handler', function () {
            var error = new Error()
            scenario.terminal.transition.handler = function () {
              throw error
            }
            var machine = new StateMachine(executor, scenario)
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Failed)
                expect(result.value).to.eq(error)
              })
          })
        })

        describe('#transitionTo', function () {
          it('throws if missing state is specified', function () {
            var machine = autoFactory()
            var lambda = function () {
              machine.transitionTo('missing')
            }
            expect(lambda).to.throw(Errors.ScenarioError)
          })

          it('throws if machine has terminated', function () {
            entrypointState.terminal = true
            var machine = autoFactory()
            return machine
              .run()
              .then(function () {
                var lambda = function () {
                  machine.transitionTo('terminal')
                }
                expect(lambda).to.throw(Errors.ScenarioError)
              })
          })

          it('aborts running transition and ignores aborted transition errors', function () {
            var barrier = new Future()
            entrypointState = stateFactory('entrypoint', function () {
              return barrier.then(function () {
                throw new Error()
              })
            })
            var machine = autoFactory()
            var promise = machine.run()
            machine.transitionTo('terminal')
            barrier.resolve()
            return promise
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                expect(terminalState.transition.handler.callCount).to.eq(1)
                expect(entrypointState.abort.handler.callCount).to.eq(1)
              })
          })

          it('can be used to reanimate idle machine', function () {
            entrypointState.transition.handler = function () {}
            var machine = autoFactory()
            return machine
              .transitionTo('entrypoint')
              .then(function () {
                expect(machine.getStatus()).to.eq(StateMachine.Status.Idle)
                machine.transitionTo('terminal')
                return machine.getTermination()
              })
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
              })
          })

          it('tolerates string trigger', function () {
            entrypointState.transition.handler = Sinon.spy(function () {
              // not `trigger.id = ?` as expected
              return {trigger: 'terminal'}
            })
            var machine = autoFactory()
            return machine
              .run()
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                expect(scenario.entrypoint.transition.handler.callCount).to.eq(1)
                expect(scenario.terminal.transition.handler.callCount).to.eq(1)
              })
          })
        })

        describe('#terminate', function () {
          it('aborts running transition', function () {
            scenario.entrypoint.transition.handler = function () {
              return new Promise(function () {})
            }
            scenario.entrypoint.abort.handler = Sinon.spy(function () {})
            var machine = autoFactory()
            machine.run()
            return machine
              .terminate()
              .then(function (result) {
                expect(result.status).to.eq(Status.Aborted)
                expect(scenario.entrypoint.abort.handler.callCount).to.eq(1)
              })
          })

          it('throws if called on inactive machine', function () {
            var machine = autoFactory()
            return machine
              .run()
              .then(function () {
                var lambda = function () {
                  machine.terminate()
                }
                expect(lambda).to.throw(Errors.InternalError)
              })
          })
        })

        describe('#getTransition()', function () {
          it('returns running transition', function () {
            scenario.entrypoint.transition.handler = function () {
              return new Promise(function () {})
            }
            var machine = autoFactory()
            var hints = {x: 12}
            expect(machine.getTransition()).to.be.null
            machine.run(hints)
            var transition = machine.getTransition()
            expect(transition.getOrigin()).to.eq(null)
            expect(transition.getTarget()).to.eq(entrypointState)
            expect(transition.getHints()).to.eq(hints)
          })

          it('returns null if transition has finished', function () {
            var machine = autoFactory()
            return machine
              .run()
              .then(function () {
                expect(machine.getTransition()).to.be.null
              })
          })
        })

        describe('#getHistory()', function () {
          it('stores up to 100 last history entries', function () {
            this.timeout(2000)
            var counter = 0
            entrypointState.transition.handler = function () {
              if (counter++ < 50) {
                return {trigger: {id: 'entrypoint'}}
              }
              return {trigger: {id: 'terminal'}}
            }
            var machine = autoFactory()
            return machine
              .run()
              .then(function () {
                expect(machine.getHistory()).to.have.lengthOf(100)
              })
          })
        })
      })
    })
  })
})
