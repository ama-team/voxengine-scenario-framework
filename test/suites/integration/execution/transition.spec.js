/* eslint-env mocha */

// noinspection SpellCheckingInspection
var helper = require('../../../helper/common')
var transitions = require('../../../../lib/execution/transition')
var concurrent = require('../../../../lib/utility/concurrent')
var TimeoutException = concurrent.TimeoutException
var schema = require('../../../../lib/schema/definitions')
var TerminationCause = schema.TerminationCause
var Transition = transitions.Transition
var TransitionState = transitions.TransitionState
var ExecutionRuntime = require('../../../../lib/execution/runtime').ExecutionRuntime
var sinon = require('sinon')
var chai = require('chai')
var assert = chai.assert

chai.should()
chai.use(require('chai-as-promised'))

describe('/execution', function () {
  /**
   * @function
   * @param {State[]} states
   * @return {StateMachine}
   */
  var factory

  beforeEach(function () {
    factory = function (origin, target, hints) {
      var runtime = new ExecutionRuntime({logger: helper.getLogger()})
      return new Transition(origin, target, hints || {}, runtime, helper.getLogger())
    }
  })

  // todo: test that cancellation tokens are cancelled when implied
  // todo: verify that correct hints are passed around
  describe('/transition.js', function () {
    helper.setup()

    it('should successfully perform straightforward transition', function () {
      var directive = {}
      var fn = sinon.spy(helper.resolvedFactory(directive))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: fn,
        timeouts: {
          transition: 1
        }
      }
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(fn.calledOnce)
        assert(result.success)
        assert.equal(result.directive, directive)
        assert.equal(result.cause, TerminationCause.Completion)
        assert.equal(transition.getState(), TransitionState.Completed)
      })
    })

    it('should call transition handler with correct parameters', function () {
      var handler = sinon.spy(helper.resolved)
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        timeouts: {
          transition: 1
        }
      }
      var hints = {x: 12}
      var transition = factory(origin, target, hints)

      return transition.run().then(function () {
        assert(handler.calledOnce)
        assert.equal(handler.getCall(0).args[0], origin)
        assert.equal(handler.getCall(0).args[1], hints)
        assert.instanceOf(handler.getCall(0).args[2], concurrent.CancellationToken)
      })
    })

    it('should correctly propagate transition exception', function () {
      var error = new Error()
      var handler = sinon.spy(helper.rejectedFactory(error))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        timeouts: {
          transition: 1
        }
      }
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(handler.calledOnce)
        assert(!result.success)
        assert.equal(result.cause, TerminationCause.TransitionFailure)
        assert.equal(result.error, error)
      })
    })

    it('should successfully timeout long transition', function () {
      var handler = sinon.spy(helper.infinite)
      var rescueHandler = sinon.spy(function (previousState, hints, token, error) {
        return Promise.reject(error)
      })
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        onTransitionTimeout: rescueHandler,
        timeouts: {
          transition: 1
        }
      }
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(handler.calledOnce)
        assert(rescueHandler.calledOnce)
        assert(!result.success)
        assert.equal(result.cause, TerminationCause.TransitionTimeout)
        assert.equal(result.error, rescueHandler.getCall(0).args[3])
      })
    })

    it('should save timed out transition with rescue handler', function () {
      var directive = {transitionedTo: 'narnia'}
      var handler = sinon.spy(helper.infinite)
      var rescueHandler = sinon.spy(helper.resolvedFactory(directive))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        onTransitionTimeout: rescueHandler,
        timeouts: {
          transition: 1,
          onTransitionTimeout: 1
        }
      }
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(handler.calledOnce)
        assert(rescueHandler.calledOnce)
        assert(result.success)
        assert.equal(result.cause, TerminationCause.Completion)
        assert.equal(result.directive, directive)
        assert.equal(transition.getState(), TransitionState.Completed)
      })
    })

    it('should correctly propagate transition rescue handler exception', function () {
      var error = new Error()
      var handler = sinon.spy(helper.infinite)
      var rescueHandler = sinon.spy(helper.rejectedFactory(error))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        onTransitionTimeout: rescueHandler,
        timeouts: {
          transition: 1,
          onTransitionTimeout: 1
        }
      }
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(handler.calledOnce)
        assert(rescueHandler.calledOnce)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.TransitionFailure)
        assert.equal(result.error, error)
        assert.equal(transition.getState(), TransitionState.Failed)
      })
    })

    it('should not save timed out transition with timed out rescue handler', function () {
      var handler = sinon.spy(helper.infinite)
      var rescueHandler = sinon.spy(helper.infinite)
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        onTransitionTimeout: rescueHandler,
        timeouts: {
          transition: 1,
          onTransitionTimeout: 1
        }
      }
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(handler.calledOnce)
        assert(rescueHandler.calledOnce)
        assert(!result.success)
        assert.equal(result.cause, TerminationCause.TransitionTimeout)
        assert.instanceOf(result.error, TimeoutException)
        assert.equal(transition.getState(), TransitionState.TimedOut)
      })
    })

    it('should successfully abort running transition', function () {
      var directive = {}
      var handler = sinon.spy(helper.infinite)
      var abortHandler = sinon.spy(helper.resolvedFactory(directive))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        abort: abortHandler,
        timeouts: {
          transition: null,
          abort: 1
        }
      }
      var transition = factory(origin, target)

      transition.run()

      assert.equal(transition.getState(), TransitionState.Running)

      return transition.abort().then(function (result) {
        assert(handler.calledOnce)
        assert(abortHandler.calledOnce)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.Abortion)
        assert.equal(transition.getState(), TransitionState.Aborted)
      })
    })

    it('should correctly propagate abort exception', function () {
      var error = new Error()
      var handler = sinon.spy(helper.infinite)
      var abortHandler = sinon.spy(helper.rejectedFactory(error))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        abort: abortHandler,
        timeouts: {
          transition: null,
          abort: 1
        }
      }
      var transition = factory(origin, target)

      transition.run()

      return transition.abort().then(function (result) {
        assert(handler.calledOnce)
        assert(abortHandler.calledOnce)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.AbortFailure)
        assert.equal(result.error, error)
        assert.equal(transition.getState(), TransitionState.Failed)
      })
    })

    it('should complete transition exceptionally on abort handler timeout', function () {
      var handler = sinon.spy(helper.infinite)
      var abortHandler = sinon.spy(helper.infinite)
      var abortTimeoutHandler = sinon.spy(function (previousState, hints, cancellationToken, error) {
        throw error
      })
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        abort: abortHandler,
        onAbortTimeout: abortTimeoutHandler,
        timeouts: {
          transition: null,
          abort: 1,
          onAbortTimeout: 1
        }
      }
      var transition = factory(origin, target)

      transition.run()

      return transition.abort().then(function (result) {
        assert(handler.calledOnce)
        assert(abortHandler.calledOnce)
        assert(abortTimeoutHandler.calledOnce)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.AbortTimeout)
        assert.instanceOf(result.error, TimeoutException)
        assert.equal(transition.getState(), TransitionState.TimedOut)
      })
    })

    it('should save timed out transition abort with abort rescue handler', function () {
      var directive = {}
      var handler = sinon.spy(helper.infinite)
      var abortHandler = sinon.spy(helper.infinite)
      var abortTimeoutHandler = sinon.spy(helper.resolvedFactory(directive))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        abort: abortHandler,
        onAbortTimeout: abortTimeoutHandler,
        timeouts: {
          transition: null,
          abort: 1,
          onAbortTimeout: 1
        }
      }
      var transition = factory(origin, target)

      transition.run()

      return transition.abort().then(function (result) {
        assert(handler.calledOnce)
        assert(abortHandler.calledOnce)
        assert(abortTimeoutHandler.calledOnce)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.Abortion)
        assert.equal(result.directive, directive)
        assert.equal(transition.getState(), TransitionState.Aborted)
      })
    })

    it('should correctly propagate abort rescue handler exception', function () {
      var error = new Error()
      var handler = sinon.spy(helper.infinite)
      var abortHandler = sinon.spy(helper.infinite)
      var abortTimeoutHandler = sinon.spy(helper.rejectedFactory(error))
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        abort: abortHandler,
        onAbortTimeout: abortTimeoutHandler,
        timeouts: {
          transition: null,
          abort: 1,
          onAbortTimeout: 1
        }
      }
      var transition = factory(origin, target)

      transition.run()

      return transition.abort().then(function (result) {
        assert(handler.calledOnce)
        assert(abortHandler.calledOnce)
        assert(abortTimeoutHandler.calledOnce)
        assert.notOk(result.success)
        assert.equal(result.cause, TerminationCause.AbortFailure)
        assert.equal(result.error, error)
        assert.equal(transition.getState(), TransitionState.Failed)
      })
    })

    it('should complete transition exceptionally on abort rescue handler timeout', function () {
      var handler = sinon.spy(helper.infinite)
      var abortHandler = sinon.spy(helper.infinite)
      var abortTimeoutHandler = sinon.spy(helper.infinite)
      var origin = { id: 'initialized' }
      var target = {
        id: 'terminated',
        transition: handler,
        abort: abortHandler,
        onAbortTimeout: abortTimeoutHandler,
        timeouts: {
          transition: null,
          abort: 1,
          onAbortTimeout: 1
        }
      }
      var transition = factory(origin, target)

      transition.run()

      return transition.abort().then(function (result) {
        assert(handler.calledOnce)
        assert(abortHandler.calledOnce)
        assert(abortTimeoutHandler.calledOnce)
        assert.equal(transition.getState(), TransitionState.TimedOut)
        assert.equal(result.cause, TerminationCause.AbortTimeout)
        assert.instanceOf(result.error, concurrent.TimeoutException)
      })
    })

    it('should correctly detect framework exception', function () {
      var origin = {
        id: 'initialized'
      }
      var target = {
        id: 'terminated',
        transition: null,
        timeouts: { transition: 1 }
      }
      // explicitly passing invalid state
      var transition = factory(origin, target)

      return transition.run().then(function (result) {
        assert(!result.success)
        assert.equal(result.cause, TerminationCause.FrameworkFailure)
      })
    })
  })
})
