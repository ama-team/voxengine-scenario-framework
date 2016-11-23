var ScenarioExecution = require('../lib/scenario-execution').ScenarioExecution,
    schema = require('../lib/schema'),
    CompletionStatus = schema.CompletionStatus,
    concurrent = require('../lib/utility/concurrent'),
    TimeoutException = concurrent.TimeoutException,
    chai = require('chai'),
    assert = chai.assert,
    chaiAsPromised = require('chai-as-promised'),
    sinon = require('sinon'),
    loggers = require('@ama-team/voxengine-sdk').loggers;

chai.use(chaiAsPromised);

// todo: not good

//noinspection JSUnusedGlobalSymbols,JSUnusedGlobalSymbols
global.VoxEngine = {
    terminate: function () {},
    customData: function () { return ''; }
};

describe('/scenario-execution.js', function () {
    var logs,
        writer,
        logger,
        factory,
        infinite = function () {
            return new Promise(function () {});
        },
        resolved = function (v) {
            return Promise.resolve(v || {})
        },
        resolvedFactory = function (v) {
            return function () {
                return resolved(v);
            }
        },
        rejected = function (e) {
            return Promise.reject(e || {});
        },
        rejectedFactory = function (e) {
            return function () {
                return rejected(e);
            };
        };

    beforeEach(function () {
        logs = [];
        //noinspection JSUnusedGlobalSymbols
        writer = {
            write: function (message) {
                logs.push(message);
            }
        };
        logger = new loggers.slf4j(writer, loggers.LogLevel.ALL);
        factory = function (scenario) {
            var context = {
                container: {
                    logger: logger
                }
            };
            return new ScenarioExecution(scenario, context);
        };
    });

    afterEach(function () {
        if (!('allure' in global)) {
            return;
        }
        if (logs.length > 0) {
            allure.createAttachment('log.txt', logs.join('\n'), 'text/plain')
        }
    });

    describe('.ScenarioExecution', function () {

        describe(': interface verification', function () {

            it('should execute simple scenario', function () {
                var transitionA = sinon.stub().returns(Promise.resolve({trigger: 'terminated'})),
                    transitionB = sinon.spy(resolved),
                    onTermination = sinon.spy(resolved),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        onTermination: onTermination,
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run()
                    .then(function (result) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.calledOnce);
                        assert(onTermination.calledOnce);
                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                        assert(result.state);
                        assert.equal(result.state.id, scenario.states[1].id);
                    });
            });

            it('should correctly work with promises instead of functions', function () {
                var scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: Promise.resolve({trigger: 'terminated'})
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: resolved()
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run()
                    .then(function (result) {
                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                        assert(result.state);
                        assert.equal(result.state.id, scenario.states[1].id);
                    });
            });

            it('should correctly handle instant .transition() result', function () {
                var transitionA = sinon.stub().returns({trigger: 'terminated'}),
                    transitionB = sinon.stub().returns({}),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function (result) {
                    assert(transitionA.calledOnce);
                    assert(transitionB.calledOnce);
                    assert(result.successful);
                    assert.equal(result.status, CompletionStatus.Completion);
                    assert(result.state);
                    assert.equal(result.state.id, scenario.states[1].id);
                });
            });

            it('should correctly handle empty .transition() result', function () {
                var transitionA = sinon.stub().returns({trigger: 'terminated'}),
                    transitionB = sinon.stub().returns(undefined),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run()
                    .then(function (result) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.calledOnce);
                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                        assert(result.state);
                        assert.equal(scenario.states[1].id, result.state.id);
                    });
            });

            it('should correctly handle different triggers', function () {
                var transitionA = sinon.stub().returns({trigger: 'stage-b:transitioned'}),
                    transitionB = sinon.stub().returns({trigger: 'relocated'}),
                    transitionC = sinon.stub().returns({trigger: {id: 'aborted', stage: 'stage-c'}}),
                    transitionD = sinon.stub().returns({trigger: {id: 'terminated'}}),
                    transitionE = sinon.stub().returns({}),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'transitioned',
                                stage: 'stage-b',
                                transition: transitionB
                            },
                            {
                                id: 'relocated',
                                stage: 'stage-b',
                                transition: transitionC
                            },
                            {
                                id: 'aborted',
                                stage: 'stage-c',
                                transition: transitionD
                            },
                            {
                                id: 'terminated',
                                stage: 'stage-c',
                                terminal: true,
                                transition: transitionE
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function (result) {
                    assert(transitionA.calledOnce);
                    assert(transitionB.calledOnce);
                    assert(transitionC.calledOnce);
                    assert(transitionD.calledOnce);
                    assert(transitionE.calledOnce);
                    assert(result.successful);
                    assert.equal(result.status, CompletionStatus.Completion);
                    assert(result.state);
                    assert.equal(scenario.states[4].id, result.state.id);
                });
            });

            it('should successfully execute scenario with no direct flow', function () {
                var transitionAResolver = sinon.spy(resolved),
                    transitionB = sinon.spy(resolved),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    var self = this;
                                    setTimeout(function () {
                                        self.transitionTo('default', 'terminated');
                                    });
                                    return transitionAResolver();
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function (result) {
                    assert(transitionAResolver.calledOnce);
                    assert(transitionAResolver.calledOnce);
                    assert(result.successful);
                    assert.equal(result.status, CompletionStatus.Completion);
                    assert(result.state);
                    assert.equal(scenario.states[1].id, result.state.id);
                });
            });

        });

        describe(': invariants', function () {

            it('should reject scenario with failed transition', function () {
                var transitionA = sinon.spy(rejected),
                    transitionB = sinon.spy(resolved),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run()
                    .then(function () {
                        assert.fail('this branch should have never been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert.equal(transitionB.callCount, 0);
                        assert.equal(failure.result.status, CompletionStatus.TransitionFailure);
                        assert.equal(failure.result.state.id, scenario.states[0].id);
                    });
            });

            it('should not reject scenario with failed abort', function () {
                var transitionA = sinon.spy(resolved),
                    abortHandler = sinon.spy(rejected),
                    transitionB = sinon.spy(resolved),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function (state, hints, token) {
                                    var self = this;
                                    setTimeout(function () {
                                        self.transitionTo('default', 'terminated');
                                    }, 1);
                                    return token.getPromise().then(transitionA);
                                },
                                abort: abortHandler,
                                timeouts: {

                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function (result) {
                    assert(transitionA.calledOnce);
                    assert(abortHandler.calledOnce);
                    assert(transitionB.calledOnce);
                    assert(result.successful);
                    assert.equal(CompletionStatus.Completion, result.status);
                });
            });

            it('should reject scenario with failed onTermination', function () {
                var transitionA = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                    transitionB = sinon.spy(resolved),
                    terminationHandler = sinon.spy(rejected),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        onTermination: terminationHandler,
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function () {
                    assert.fail('This branch should have never been executed');
                }, function (failure) {
                    assert(transitionA.calledOnce);
                    assert(transitionB.calledOnce);
                    assert(terminationHandler.calledOnce);
                    assert(!failure.result.successful);
                    assert.equal(failure.result.status, CompletionStatus.Completion);
                    assert(failure.result.terminationError);
                });

            });

            it('should pass same hints to .transition, .abort and timeout handlers', function () {
                assert.fail('slothful test');
                var initializeTransitionHandler = sinon.spy(infinite),
                    initializeAbortHandler = sinon.spy(infinite),
                    initializeAbortTimeoutHandler = sinon.spy(resolved),
                    interceptTransitionHandler = sinon.spy(infinite),
                    interceptTransitionTimeoutHandler = sinon.spy(resolved),
                    interceptTimeoutHandler = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                    terminalTransitionHandler = sinon.spy(resolved),
                    hints = {x: 12},
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: initializeTransitionHandler,
                                abort: initializeAbortHandler,
                                onAbortTimeout: initializeAbortTimeoutHandler,
                                timeouts: {
                                    onTransitionTimeout: null,
                                    abort: 1
                                }
                            },
                            {
                                id: 'intercept',
                                transition: interceptTransitionHandler,
                                onTransitionTimeout: interceptTransitionTimeoutHandler,
                                onTimeout: interceptTimeoutHandler,
                                timeouts: {
                                    state: 1,
                                    transition: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: terminalTransitionHandler
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                execution.transitionTo('default', 'initialized', hints);

                return execution.transitionTo('default', 'intercept', hints)
                    .then(execution.getTerminationHook)
                    .then(function (result) {
                        initializeTransitionHandler.getCall(0).args[1].should.be.equal(hints);
                        initializeAbortHandler.getCall(0).args[1].should.be.equal(hints);
                        initializeAbortTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                        interceptTransitionHandler.getCall(0).args[1].should.be.equal(hints);
                        interceptTransitionTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                        assert(interceptTimeoutHandler.getCall(0));
                        interceptTimeoutHandler.getCall(0).args[1].should.be.equal(hints);

                        assert(result.successful);
                        assert(result.status, CompletionStatus.Completion);
                    });
            });

            it('should pass rejection value to scenario result', function () {
                var error = new Error(),
                    transitionA = sinon.spy(rejectedFactory(error)),
                    transitionB = sinon.spy(resolved),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transitionA
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: transitionB
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function () {
                    assert.fail('this branch should not have been executed');
                }, function (failure) {
                    assert(transitionA.calledOnce);
                    assert.equal(transitionB.callCount, 0);
                    assert(!failure.result.successful);
                    assert.equal(failure.result.status, CompletionStatus.TransitionFailure);
                    assert.equal(failure.result.error, error);
                });
            });
        });

        describe(': timeouts', function () {

            describe(': scenario', function () {

                it('should timeout excessively long scenario', function () {
                    assert.fail('slothful test');
                    var transitionHandler = sinon.spy(function (state, hints, token) {
                            return token.getPromise();
                        }),
                        timeoutHandler = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionHandler
                                },
                                {
                                    id: 'terminated',
                                    terminal: true
                                }
                            ],
                            onTimeout: timeoutHandler,
                            trigger: schema.TriggerType.Http,
                            timeouts: {
                                scenario: 1
                            }
                        },
                        execution = factory(scenario);

                    return execution.run().then(function () {
                        assert.fail('this branch should not have been executed');
                    }, function (failure) {
                        assert(transitionHandler.calledOnce);
                        assert(timeoutHandler.calledOnce);
                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.ScenarioTimeout);
                        assert.instanceOf(failure.result.error, TimeoutException);
                    });
                });


                it('should reject scenario with timed out onTermination', function () {
                    var transitionA = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                        transitionB = sinon.spy(resolved),
                        terminationHandler = sinon.spy(infinite),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            onTermination: terminationHandler,
                            trigger: schema.TriggerType.Http,
                            timeouts: {
                                onTermination: 1
                            }
                        },
                        execution = factory(scenario);

                    return execution.run().then(function () {
                        assert.fail('This branch should have never been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.calledOnce);
                        assert(terminationHandler.calledOnce);
                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.Completion);
                        assert.instanceOf(failure.terminationError, TimeoutException);
                    });
                });

                it('should save scenario with timed out termination handler by rescue handler', function () {
                    var transitionA = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                        transitionB = sinon.spy(resolved),
                        terminationHandler = sinon.spy(infinite),
                        terminationTimeoutHandler = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            onTermination: terminationHandler,
                            onTerminationTimeout: terminationTimeoutHandler,
                            trigger: schema.TriggerType.Http,
                            timeouts: {
                                onTermination: 1
                            }
                        },
                        execution = factory(scenario);

                    return execution.run().then(function (result) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.calledOnce);
                        assert(terminationHandler.calledOnce);
                        assert(terminationTimeoutHandler.calledOnce);
                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                        assert.notOk(result.terminationError);
                    });
                });

                it('should reject scenario if both termination handler and rescue handler time out', function () {
                    var transitionA = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                        transitionB = sinon.spy(resolved),
                        terminationHandler = sinon.spy(infinite),
                        terminationTimeoutHandler = sinon.spy(infinite),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            onTermination: terminationHandler,
                            onTerminationTimeout: terminationTimeoutHandler,
                            trigger: schema.TriggerType.Http,
                            timeouts: {
                                onTermination: 1,
                                onTerminationTimeout: 1
                            }
                        },
                        execution = factory(scenario);

                    return execution.run().then(function () {
                        assert.fail('This branch should have not been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.calledOnce);
                        assert(terminationHandler.calledOnce);
                        assert(terminationTimeoutHandler.calledOnce);
                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.Completion);
                        assert.instanceOf(failure.result.terminationError, TimeoutException);
                    });
                });

            });

            describe(': state', function () {

                it('should timeout excessively long state', function () {
                    var transitionA = sinon.spy(resolved),
                        transitionB = sinon.spy(resolved),
                        timeoutHandler = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    onTimeout: timeoutHandler,
                                    timeouts: {
                                        state: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    return execution.run().then(function () {
                        assert.fail('this branch should have not been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.callCount, 0);
                        assert(timeoutHandler.calledOnce);
                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.StateTimeout);
                        assert.instanceOf(failure.result.error, TimeoutException);
                    });
                });

                it('should save timed out state by onTimeout handler', function () {
                    var rescueHandler = sinon.spy(resolvedFactory({trigger: 'terminated'})),
                        transitionA = sinon.spy(resolved),
                        transitionB = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    onTimeout: rescueHandler,
                                    timeouts: {
                                        self: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    execution.run().then(function (result) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.calledOnce);
                        assert(rescueHandler.calledOnce);
                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                    });
                });

                it('should reject scenario in case of both state and rescue handler timeouts', function () {
                    assert.fail('slothful test');
                    var transitionA = sinon.spy(function (state, hints, token) {
                            return token.getPromise();
                        }),
                        rescueHandler = sinon.spy(function (state, hints, token, error) {
                            return token.getPromise();
                        }),
                        transitionB = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    onTimeout: rescueHandler,
                                    timeouts: {
                                        state: 1,
                                        onTimeout: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    execution.run().then(function () {
                        assert.fail('this branch should have never been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert(transitionB.callCount, 0);
                        assert(rescueHandler.calledOnce);
                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.StateTimeout);
                        assert.instanceOf(failure.result.error, TimeoutException);
                    });
                });
            });

            describe(': transition', function () {

                it('should reject on timed out transition with no rescue handler', function () {
                    var transitionA = sinon.spy(infinite),
                        transitionB = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    timeouts: {
                                        transition: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    execution.run().then(function () {
                        assert.fail('this branch should have never been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert.equal(transitionB.callCount, 0);
                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.TransitionTimeout);
                        assert.instanceOf(failure.result.error, TimeoutException);
                    });
                });

                it('should run rescue handler on timed out transition', function () {
                    var transitionA = sinon.spy(infinite),
                        rescueHandler = sinon.spy(resolved),
                        transitionB = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    onTransitionTimeout: rescueHandler,
                                    timeouts: {
                                        transition: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    execution.run().then(function (result) {
                        assert(transitionA.calledOnce);
                        assert(rescueHandler.calledOnce);
                        assert(transitionB.calledOnce);

                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                    });
                });

                it('should reject scenario with timed out transition and rescue handler', function () {
                    var transitionA = sinon.spy(infinite),
                        rescueHandler = sinon.spy(infinite),
                        transitionB = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    onTransitionTimeout: rescueHandler,
                                    timeouts: {
                                        transition: 1,
                                        onTransitionTimeout: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    execution.run().then(function () {
                        assert.fail('this branch should have never been executed');
                    }, function (failure) {
                        assert(transitionA.calledOnce);
                        assert(rescueHandler.calledOnce);
                        assert(transitionB.callCount, 0);

                        assert(!failure.result.successful);
                        assert.equal(failure.result.status, CompletionStatus.TransitionTimeout);
                        assert.instanceOf(failure.result.error, TimeoutException);
                    });
                });
            });

            describe(': abort', function () {
                it('should run rescue handler on timed out abort', function () {
                    var transitionA = sinon.spy(function (state, hints, token) {
                            this.transitionTo('default', 'terminated');
                            return token.getPromise();
                        }),
                        abortHandler = sinon.spy(infinite),
                        rescueHandler = sinon.spy(resolved),
                        transitionB = sinon.spy(resolved),
                        scenario = {
                            states: [
                                {
                                    id: 'initialized',
                                    entrypoint: true,
                                    transition: transitionA,
                                    abort: abortHandler,
                                    onAbortTimeout: rescueHandler,
                                    timeouts: {
                                        abort: 1
                                    }
                                },
                                {
                                    id: 'terminated',
                                    terminal: true,
                                    transition: transitionB
                                }
                            ],
                            trigger: schema.TriggerType.Http
                        },
                        execution = factory(scenario);

                    return execution.run().then(function (result) {
                        assert(transitionA.calledOnce);
                        assert(abortHandler.calledOnce);
                        assert(rescueHandler.calledOnce);
                        assert(transitionB.calledOnce);

                        assert(result.successful);
                        assert.equal(result.status, CompletionStatus.Completion);
                    });
                });
            });

        });
    });
});