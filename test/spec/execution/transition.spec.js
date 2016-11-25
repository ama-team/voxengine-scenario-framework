//noinspection SpellCheckingInspection
var helper = require('../../helper/common'),
    transitions = require('../../../lib/execution/transition'),
    concurrent = require('../../../lib/utility/concurrent'),
    Transition = transitions.Transition,
    TransitionState = transitions.TransitionState,
    TransitionExecutionException = transitions.TransitionExecutionException,
    ExecutionRuntime = require('../../../lib/execution/runtime').ExecutionRuntime,
    sinon = require('sinon'),
    chai = require('chai'),
    should = chai.should(),
    assert = chai.assert;

chai.use(require('chai-as-promised'));
helper.setup();

describe('/execution', function () {

    /**
     * @function
     * @param {StateDeclaration[]} states
     * @return {StateMachine}
     */
    var factory;

    beforeEach(function () {
        factory = function (origin, target, hints) {
            var runtime = new ExecutionRuntime({logger: helper.getLogger()});
            return new Transition(origin, target, hints || {}, runtime, helper.getLogger());
        }
    });

    // todo: test that cancellation tokens are cancelled when implied
    // todo: verify that correct hints are passed around
    describe('/transition.js', function () {

        it('should successfully perform straightforward transition', function () {
            var value = {},
                fn = sinon.spy(helper.resolvedFactory(value)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: fn,
                    timeouts: {
                        transition: 1
                    }
                },
                transition = factory(origin, target);

            return transition.run().then(function (v) {
                assert(fn.calledOnce);
                assert.equal(v, value);
                assert.equal(transition.getState(), TransitionState.Completed);
            });
        });

        it('should call transition handler with correct parameters', function () {
            var handler = sinon.spy(helper.resolved),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    timeouts: {
                        transition: 1
                    }
                },
                hints = {x: 12},
                transition = factory(origin, target, hints);

            return transition.run().then(function () {
                assert(handler.calledOnce);
                assert.equal(handler.getCall(0).args[0], origin);
                assert.equal(handler.getCall(0).args[1], hints);
                assert.instanceOf(handler.getCall(0).args[2], concurrent.CancellationToken);
            });
        });

        it('should correctly propagate transition exception', function () {
            var error = new Error(),
                fn = sinon.spy(helper.rejectedFactory(error)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: fn,
                    timeouts: {
                        transition: 1
                    }
                },
                transition = factory(origin, target);

            return transition.run().then(function () {
                assert.fail('This branch should not have been executed');
            }, function (e) {
                assert.instanceOf(e, TransitionExecutionException);
                assert.equal(e.error, error);
                assert.equal(e.status, TransitionState.Failed);
            });
        });

        it('should successfully timeout long transition', function () {
            var handler = sinon.spy(helper.infinite),
                rescueHandler = sinon.spy(function (previousState, hints, token, error) {
                    return Promise.reject(error);
                }),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    onTransitionTimeout: rescueHandler,
                    timeouts: {
                        transition: 1
                    }
                },
                transition = factory(origin, target);

            return transition.run().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(rescueHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.equal(e.status, TransitionState.TimedOut);
                assert.equal(e.error, rescueHandler.getCall(0).args[3]);
            });
        });

        it('should save timed out transition with rescue handler', function () {
            var value = {x: 12},
                handler = sinon.spy(helper.infinite),
                rescueHandler = sinon.spy(helper.resolvedFactory(value)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    onTransitionTimeout: rescueHandler,
                    timeouts: {
                        transition: 1,
                        onTransitionTimeout: 1
                    }
                },
                transition = factory(origin, target);

            return transition.run().then(function (v) {
                assert(handler.calledOnce);
                assert(rescueHandler.calledOnce);
                assert.equal(v, value);
                assert.equal(transition.getState(), TransitionState.Completed);
            });
        });

        it('should correctly propagate transition rescue handler exception', function () {
            var error = new Error(),
                handler = sinon.spy(helper.infinite),
                rescueHandler = sinon.spy(helper.rejectedFactory(error)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    onTransitionTimeout: rescueHandler,
                    timeouts: {
                        transition: 1,
                        onTransitionTimeout: 1
                    }
                },
                transition = factory(origin, target);

            return transition.run().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(rescueHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.equal(e.error, error);
                assert.equal(transition.getState(), TransitionState.Failed);
            });
        });

        it('should not save timed out transition with timed out rescue handler', function () {
            var handler = sinon.spy(helper.infinite),
                rescueHandler = sinon.spy(helper.infinite),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    onTransitionTimeout: rescueHandler,
                    timeouts: {
                        transition: 1,
                        onTransitionTimeout: 1
                    }
                },
                transition = factory(origin, target);

            return transition.run().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(rescueHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.instanceOf(e.error, concurrent.TimeoutException);
                assert.equal(transition.getState(), TransitionState.TimedOut);
            });
        });

        it('should successfully abort running transition', function () {
            var value = {},
                handler = sinon.spy(helper.infinite),
                abortHandler = sinon.spy(helper.resolvedFactory(value)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    abort: abortHandler,
                    timeouts: {
                        transition: null,
                        abort: 1
                    }
                },
                transition = factory(origin, target);

            transition.run();

            assert.equal(transition.getState(), TransitionState.Running);

            return transition.abort().then(function (v) {
                assert(handler.calledOnce);
                assert(abortHandler.calledOnce);
                assert.equal(v, value);
                assert.equal(transition.getState(), TransitionState.Aborted);
            });
        });

        it('should correctly propagate abort exception', function () {
            var error = new Error(),
                handler = sinon.spy(helper.infinite),
                abortHandler = sinon.spy(helper.rejectedFactory(error)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    abort: abortHandler,
                    timeouts: {
                        transition: null,
                        abort: 1
                    }
                },
                transition = factory(origin, target);

            transition.run();

            return transition.abort().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(abortHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.equal(e.error, error);
                assert.equal(transition.getState(), TransitionState.Failed);
            });
        });

        it('should complete transition exceptionally on abort handler timeout', function () {
            var handler = sinon.spy(helper.infinite),
                abortHandler = sinon.spy(helper.infinite),
                abortTimeoutHandler = sinon.spy(function (previousState, hints, cancellationToken, error) {
                    throw error;
                }),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    abort: abortHandler,
                    onAbortTimeout: abortTimeoutHandler,
                    timeouts: {
                        transition: null,
                        abort: 1,
                        onAbortTimeout: 1
                    }
                },
                transition = factory(origin, target);

            transition.run();

            return transition.abort().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(abortHandler.calledOnce);
                assert(abortTimeoutHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.instanceOf(e.error, concurrent.TimeoutException);
                assert.equal(transition.getState(), TransitionState.TimedOut);
            });
        });

        it('should save timed out transition abort with abort rescue handler', function () {
            var value = {},
                handler = sinon.spy(helper.infinite),
                abortHandler = sinon.spy(helper.infinite),
                abortTimeoutHandler = sinon.spy(helper.resolvedFactory(value)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    abort: abortHandler,
                    onAbortTimeout: abortTimeoutHandler,
                    timeouts: {
                        transition: null,
                        abort: 1,
                        onAbortTimeout: 1
                    }
                },
                transition = factory(origin, target);

            transition.run();

            return transition.abort().then(function (v) {
                assert(handler.calledOnce);
                assert(abortHandler.calledOnce);
                assert(abortTimeoutHandler.calledOnce);
                assert.equal(v, value);
                assert.equal(transition.getState(), TransitionState.Aborted);
            });
        });

        it('should correctly propagate abort rescue handler exception', function () {
            var error = new Error(),
                handler = sinon.spy(helper.infinite),
                abortHandler = sinon.spy(helper.infinite),
                abortTimeoutHandler = sinon.spy(helper.rejectedFactory(error)),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    abort: abortHandler,
                    onAbortTimeout: abortTimeoutHandler,
                    timeouts: {
                        transition: null,
                        abort: 1,
                        onAbortTimeout: 1
                    }
                },
                transition = factory(origin, target);

            transition.run();

            return transition.abort().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(abortHandler.calledOnce);
                assert(abortTimeoutHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.equal(e.error, error);
                assert.equal(transition.getState(), TransitionState.Failed);
            });
        });

        it('should complete transition exceptionally on abort rescue handler timeout', function () {
            var handler = sinon.spy(helper.infinite),
                abortHandler = sinon.spy(helper.infinite),
                abortTimeoutHandler = sinon.spy(helper.infinite),
                origin = { id: 'initialized' },
                target = {
                    id: 'terminated',
                    transition: handler,
                    abort: abortHandler,
                    onAbortTimeout: abortTimeoutHandler,
                    timeouts: {
                        transition: null,
                        abort: 1,
                        onAbortTimeout: 1
                    }
                },
                transition = factory(origin, target);

            transition.run();

            return transition.abort().then(helper.restrictedBranchHandler, function (e) {
                assert(handler.calledOnce);
                assert(abortHandler.calledOnce);
                assert(abortTimeoutHandler.calledOnce);
                assert.instanceOf(e, TransitionExecutionException);
                assert.instanceOf(e.error, concurrent.TimeoutException);
                assert.equal(transition.getState(), TransitionState.TimedOut);
            });
        });

        it('should correctly detect framework exception', function () {
            var origin = {
                    id: 'initialized'
                },
                target = {
                    id: 'terminated',
                    transition: null,
                    timeouts: { transition: 1 }
                },
                // explicitly passing invalid state
                transition = factory(origin, target);

            return transition.run().then(helper.restrictedBranchHandler, function (e) {
                assert.instanceOf(e, TransitionExecutionException);
                assert.ok(e.error);
                assert.equal(e.status, TransitionState.Exploded);
            });
        })
    });

});