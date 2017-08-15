/* eslint-env mocha */
/* global allure */

var stateMachineModule = require('../../../../lib/execution/state-machine')
var StateMachine = stateMachineModule.StateMachine
var MachineState = stateMachineModule.MachineStatus
var ExecutionRuntime = require('../../../../lib/execution/runtime').ExecutionRuntime
var schema = require('../../../../lib/schema/definitions')
var TerminationCause = schema.TerminationCause
var concurrent = require('../../../../lib/utility/concurrent')
var TimeoutException = concurrent.TimeoutException
var slf4j = require('@ama-team/voxengine-sdk').logger.slf4j
var Slf4j = slf4j.Slf4j
var LogLevel = slf4j.Level
var sinon = require('sinon')
var chai = require('chai')
var assert = chai.assert
var helper = require('../../../helper/common')

chai.should()
chai.use(require('chai-as-promised'))

describe('/execution', function () {
  var logs
  var logger
  /**
   * @function
   * @param {State[]} states
   * @return {StateMachine}
   */
  var factory

  beforeEach(function () {
    logs = []
    var writer = {
      write: function (message) {
        logs.push(message)
      }
    }
    var name = 'ama-team.voxengine-scenario-framework.test.spec.execution.state-machine'
    logger = new Slf4j(name, LogLevel.All, writer)
    factory = function (states) {
      states.forEach(function (state) { state.timeouts = state.timeouts || {} })
      return new StateMachine(states, new ExecutionRuntime(), logger)
    }
  })

  afterEach(function () {
    if (!('allure' in global)) {
      // nothing to do here -_-
      return
    }
    if (logs.length) {
      allure.createAttachment('state-machine.log', logs.join('\n'), 'text/plain')
    }
  })

  describe('/state-machine.js', function () {
    it('should execute straightforward scenario', function () {
      var transitionA = sinon.spy(helper.resolvedFactory({trigger: {id: 'terminated'}}))
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          entrypoint: true,
          timeouts: {}
        },
        {
          id: 'terminated',
          transition: transitionB,
          timeouts: {},
          terminal: true
        }
      ]
      var machine = factory(scenario)

      return machine.run().then(function (result) {
        assert(transitionA.calledOnce)
        assert(transitionB.calledOnce)
        assert(result.success)
        assert.equal(result.cause, TerminationCause.Completion)
        assert.equal(machine.getState(), MachineState.Terminated)
        assert.equal(machine.getHistory()[0].id, scenario[0].id)
        assert.equal(machine.getHistory()[1].id, scenario[1].id)
      })
    })

    it('should execute async scenario', function () {
      var transitionA = sinon.spy(function () {
        var self = this
        setTimeout(function () {
          self.transitionTo('terminated')
        }, 1)
        return helper.infinite()
      })
      var abortHandler = sinon.spy(helper.resolvedFactory({}))
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          entrypoint: true,
          abort: abortHandler,
          timeouts: {
            state: 2
          }
        },
        {
          id: 'terminated',
          transition: transitionB,
          terminal: true
        }
      ]
      var machine = factory(scenario)

      return machine.run().then(function (result) {
        assert(transitionA.calledOnce)
        assert(abortHandler.calledOnce)
        assert(transitionB.calledOnce)
        assert(result.success)
        assert.equal(result.cause, TerminationCause.Completion)
      })
    })

    it('should timeout excessively long state', function () {
      var transitionA = sinon.spy(helper.resolvedFactory({}))
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          entrypoint: true,
          timeouts: {
            state: 1
          }
        },
        {
          id: 'terminated',
          transition: transitionB,
          terminal: true
        }
      ]
      var machine = factory(scenario)

      return machine.run().then(function (result) {
        assert(transitionA.calledOnce)
        assert.equal(transitionB.callCount, 0)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.StateTimeout)
      })
    })

    it('should correctly report failed transition', function () {
      var e = new Error()
      var transitionA = sinon.spy(function () { throw e })
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          entrypoint: true
        },
        {
          id: 'terminated',
          transition: transitionB,
          terminal: true
        }
      ]
      var machine = factory(scenario)

      return machine.run().then(function (result) {
        assert(transitionA.calledOnce)
        assert.equal(transitionB.callCount, 0)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.TransitionFailure)
        assert.equal(result.error, e)
      })
    })

    it('should correctly report timed out transition', function () {
      var transitionA = sinon.spy(helper.infinite)
      var rescueHandler = sinon.spy(function (s, h, t, e) {
        throw e
      })
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          entrypoint: true,
          onTransitionTimeout: rescueHandler,
          timeouts: {
            transition: 1
          }
        },
        {
          id: 'terminated',
          transition: transitionB,
          terminal: true
        }
      ]
      var machine = factory(scenario)

      return machine.run().then(function (result) {
        assert(transitionA.calledOnce)
        assert(rescueHandler.calledOnce)
        assert.equal(transitionB.callCount, 0)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.TransitionTimeout)
        assert.instanceOf(result.error, TimeoutException)
        assert.equal(result.state.id, 'initialized')
      })
    })

    it('should not reject on transition abort fail', function () {
      var e = new Error()
      var transitionA = sinon.spy(function (state, hints, token) {
        return token.getPromise()
      })
      var abort = sinon.spy(function () {
        return Promise.reject(e)
      })
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          abort: abort,
          entrypoint: true
        },
        {
          id: 'terminated',
          transition: transitionB,
          terminal: true
        }
      ]
      var machine = factory(scenario)

      machine.run()

      machine.transitionTo('terminated')

      return machine.getCompletion().then(function (result) {
        assert(transitionA.calledOnce)
        assert(abort.calledOnce)
        assert(transitionB.calledOnce)

        assert(result.success)
        assert.equal(result.cause, TerminationCause.Completion)
      })
    })

    it('should decline calls on terminated machine', function () {
      var transitionA = sinon.spy(helper.resolvedFactory({trigger: {id: 'terminated'}}))
      var transitionB = sinon.spy(helper.resolvedFactory({}))
      var scenario = [
        {
          id: 'initialized',
          transition: transitionA,
          entrypoint: true
        },
        {
          id: 'terminated',
          transition: transitionB,
          terminal: true
        }
      ]
      var machine = factory(scenario)

      return machine.run().then(function () {
        return machine.run()
      }).then(function (result) {
        assert.isFalse(result.success)
        assert.equal(result.cause, TerminationCause.InvalidUsage)
      }).then(function () {
        return machine.transitionTo('initialized')
      }).then(function (result) {
        assert.isFalse(result.success)
        assert.equal(result.cause, TerminationCause.InvalidUsage)
      })
    })
  })
})
