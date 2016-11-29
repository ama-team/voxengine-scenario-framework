var stateMachineModule = require('../../../lib/execution/state-machine'),
    StateMachine = stateMachineModule.StateMachine,
    MachineState = stateMachineModule.MachineState,
    MachineTerminationException = stateMachineModule.MachineTerminationException,
    MachineTerminationCause = stateMachineModule.MachineTerminationCause,
    ExecutionRuntime = require('../../../lib/execution/runtime').ExecutionRuntime,
    loggers = require('@ama-team/voxengine-sdk').loggers,
    sinon = require('sinon'),
    chai = require('chai'),
    should = chai.should(),
    assert = chai.assert,
    helper = require('../../helper/common');

chai.use(require('chai-as-promised'));

describe('/execution', function () {

    var logs,
        logger;
        /**
         * @function
         * @param {StateDeclaration[]} states
         * @return {StateMachine}
         */
    var factory;

    beforeEach(function () {
        logs = [];
        var writer = {
            write: function (message) {
                logs.push(message);
            }
        };
        logger = new loggers.slf4j(writer, loggers.LogLevel.All);
        factory = function (states) {
            states.forEach(function (state) { state.timeouts = state.timeouts || {}; });
            return new StateMachine(states, new ExecutionRuntime(), logger);
        }
    });

    afterEach(function () {
        if (!('allure' in global)) {
            // nothing to do here -_-
            return;
        }
        if (logs.length) {
            allure.createAttachment('state-machine.log', logs.join('\n'), 'text/plain');
        }
    });

    describe('/state-machine.js', function () {

        it('should execute straightforward scenario', function () {
            var transitionA = sinon.spy(helper.resolvedFactory({ trigger: {id: 'terminated'}})),
                transitionB = sinon.spy(helper.resolved),
                scenario = [
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
                ],
                machine = factory(scenario);

            return machine.run().then(function () {
                assert(transitionA);
                assert(transitionB);
                assert.equal(machine.getState(), MachineState.Terminated);
                assert.equal(machine.getHistory()[0].id, scenario[0].id);
                assert.equal(machine.getHistory()[1].id, scenario[1].id);
            });
        });

        it('should execute async scenario', function () {
            var transitionA = sinon.spy(function () {
                    var self = this;
                    setTimeout(function () {
                        self.transitionTo('terminated');
                    }, 1);
                    return Promise.resolve({});
                }),
                abortHandler = sinon.spy(helper.resolved),
                transitionB = sinon.spy(helper.resolved),
                scenario = [
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
                ],
                machine = factory(scenario);

            machine.run().then(function () {
                assert(transitionA.calledOnce);
                assert(abortHandler.calledOnce);
                assert(transitionB.calledOnce);
            });
        });

        it('should timeout excessively long state', function () {
            var transitionA = sinon.spy(helper.infinite),
                transitionB = sinon.spy(helper.resolvedFactory({})),
                scenario = [
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
                ],
                machine = factory(scenario);

            return machine.run().then(helper.restrictedBranchHandler, function (e) {
                assert(transitionA.calledOnce);
                assert.equal(transitionB.callCount, 0);
                assert.instanceOf(e, MachineTerminationException);
                assert.equal(e.cause, MachineTerminationCause.StateTimeout);
            });
        });

        it('should correctly report failed transition', function () {
            var e = new Error(),
                transitionA = sinon.spy(function () { throw e; }),
                transitionB = sinon.spy(helper.resolvedFactory({})),
                scenario = [
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
                ],
                machine = factory(scenario);

            return machine.run().then(helper.restrictedBranchHandler, function (error) {
                assert(transitionA.calledOnce);
                assert.equal(transitionB.callCount, 0);
                assert.instanceOf(error, MachineTerminationException);
                assert.equal(error.cause, MachineTerminationCause.TransitionFail);
                assert.equal(error.error, e);
            });
        });

        it('should correctly report timed out transition', function () {
            var transitionA = sinon.spy(helper.infinite),
                transitionB = sinon.spy(helper.resolvedFactory({})),
                scenario = [
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
                ],
                machine = factory(scenario);

            return machine.run().then(helper.restrictedBranchHandler, function (error) {
                assert(transitionA.calledOnce);
                assert.equal(transitionB.callCount, 0);
                assert.instanceOf(error, MachineTerminationException);
                assert.equal(error.cause, MachineTerminationCause.TransitionTimeout);
            });
        });

        it('should not reject on transition abort fail', function () {
            var e = new Error(),
                transitionA = sinon.spy(function (state, hints, token) {
                    return token.getPromise();
                }),
                abort = sinon.spy(function () {
                    return Promise.reject(e);
                }),
                transitionB = sinon.spy(helper.resolvedFactory({})),
                scenario = [
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
                ],
                machine = factory(scenario);

            machine.run();

            machine.transitionTo('terminated');

            return machine.getCompletion().then(function () {
                assert(transitionB.calledOnce);
                assert(abort.calledOnce);
                assert(transitionB.calledOnce);
            });
        });
    });
});