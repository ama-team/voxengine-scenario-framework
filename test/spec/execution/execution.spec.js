var helper = require('../../helper/common'),
    schema = require('../../../lib/schema'),
    MachineTerminationResult = schema.MachineTerminationResult,
    TerminationCause = schema.TerminationCause,
    execution = require('../../../lib/execution/execution'),
    Execution = execution.Execution,
    chai = require('chai'),
    assert = chai.assert,
    sinon = require('sinon');

describe('/execution', function () {
    var stateMachineFactory = function (cause, error, state) {
            return {
                run: sinon.spy(helper.resolvedFactory(new MachineTerminationResult(cause, error, state)))
            }
        },
        runtimeFactory = function (value) {
            return {
                execute: sinon.spy(function () {
                    var result = null;
                    if (arguments.length) {
                        result = arguments[0].apply({}, Array.prototype.slice.call(arguments, 1));
                    }
                    return result || Promise.resolve(value);
                })
            }
        },
        scenarioFactory = function (onTermination, onTerminationTimeout, timeouts) {
            timeouts = timeouts || {onTermination: null, onTerminationTimeout: null};
            onTerminationTimeout = onTerminationTimeout || function (token, error) {
                throw error;
            };
            onTermination = onTermination || helper.resolvedFactory({});
            return {
                states: [],
                onTermination: sinon.spy(onTermination),
                onTerminationTimeout: sinon.spy(onTerminationTimeout),
                timeouts: timeouts
            };
        };

    describe('/execution.js', function () {

        describe('.Execution', function () {

            helper.setup();

            it('should correctly execute scenario', function () {
                var scenario = scenarioFactory(),
                    runtime = runtimeFactory({}),
                    machine = stateMachineFactory(TerminationCause.Completion),
                    execution = new Execution(scenario, machine, runtime, helper.getLogger());

                return execution.run().then(function (result) {
                    assert(result.success);
                    assert.equal(result.cause, TerminationCause.Completion);
                    assert.isNull(result.error);
                    assert.isNull(result.state);

                    assert(runtime.execute.callCount > 0);
                    assert(machine.run.calledOnce);
                    assert(scenario.onTermination.calledOnce);
                    assert.equal(scenario.onTerminationTimeout.callCount, 0);
                });
            });

            it('should run onTerminationTimeout on termination handler timeout', function () {
                var scenario = scenarioFactory(function (t) {
                        return t.getPromise();
                    }, helper.resolvedFactory({}), {onTermination: 1}),
                    runtime = runtimeFactory({}),
                    machine = stateMachineFactory(TerminationCause.Completion),
                    execution = new Execution(scenario, machine, runtime, helper.getLogger());

                return execution.run().then(function (result) {
                    assert(result.success);
                    assert.equal(result.cause, TerminationCause.Completion);
                    assert.isNull(result.error);
                    assert.isNull(result.state);

                    assert(runtime.execute.callCount > 0);
                    assert(machine.run.calledOnce);
                    assert(scenario.onTermination.calledOnce);
                    assert(scenario.onTerminationTimeout.calledOnce);
                });
            });

            it('should not report success if termination handler has failed', function () {
                var error = new Error(),
                    scenario = scenarioFactory(function () { return Promise.reject(error); }),
                    runtime = runtimeFactory({}),
                    machine = stateMachineFactory(TerminationCause.Completion),
                    execution = new Execution(scenario, machine, runtime, helper.getLogger());

                return execution.run().then(function (result) {
                    assert(!result.success);
                    assert.equal(result.cause, TerminationCause.Completion);
                    assert.isNull(result.error);
                    assert.isNull(result.state);
                    assert.equal(result.terminationError, error);

                    assert(runtime.execute.callCount > 0);
                    assert(machine.run.calledOnce);
                    assert(scenario.onTermination.calledOnce);
                    assert.equal(scenario.onTerminationTimeout.callCount, 0);
                });
            });

            it('should catch inadequate state machine result', function () {
                var scenario = scenarioFactory(),
                    runtime = runtimeFactory({}),
                    machine = {
                        run: sinon.spy(function () {
                            return Promise.resolve({});
                        })
                    },
                    execution = new Execution(scenario, machine, runtime, helper.getLogger());

                return execution.run().then(function (result) {
                    assert(!result.success);
                    assert.equal(result.cause, TerminationCause.FrameworkFailure);
                    assert.isNull(result.state);
                    assert.isNull(result.terminationError);

                    assert(machine.run.calledOnce);
                    assert.equal(scenario.onTermination.callCount, 1);
                    assert.equal(scenario.onTerminationTimeout.callCount, 0);
                });
            });

            it('should catch state machine error', function () {
                var error = new Error(),
                    scenario = scenarioFactory(),
                    runtime = runtimeFactory({}),
                    machine = {
                        run: sinon.spy(function () {
                            return Promise.reject(error);
                        })
                    },
                    execution = new Execution(scenario, machine, runtime, helper.getLogger());

                return execution.run().then(function (result) {
                    assert(!result.success);
                    assert.equal(result.cause, TerminationCause.FrameworkFailure);
                    assert.equal(result.error, error);
                    assert.isNull(result.state);
                    assert.isNull(result.terminationError);

                    assert(machine.run.calledOnce);
                    assert.equal(scenario.onTermination.callCount, 1);
                    assert.equal(scenario.onTerminationTimeout.callCount, 0);
                });
            });

            it('should catch double execution', function () {

                var scenario = scenarioFactory(),
                    runtime = runtimeFactory({}),
                    machine = {
                        run: sinon.spy(function () {
                            return Promise.resolve({});
                        })
                    },
                    execution = new Execution(scenario, machine, runtime, helper.getLogger());

                return execution.run().then(function () {
                    return execution.run();
                }).then(function (result) {
                    assert(!result.success);
                    assert.equal(result.cause, TerminationCause.InvalidUsage);
                });
            });

            it('should timeout excessively long scenario', function () {
                assert.fail('Not implemented');
            });

        });
    });
});