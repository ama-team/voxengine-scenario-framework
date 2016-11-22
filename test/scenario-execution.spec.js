var ScenarioExecution = require('../lib/scenario-execution').ScenarioExecution,
    schema = require('../lib/schema'),
    concurrent = require('../lib/utility/concurrent'),
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

describe('scenario-execution', function () {
    var logs,
        writer,
        logger,
        factory,
        infinitePromise = new Promise(function () {});

    function TestingException(message) {
        this.name = 'TestingException';
        this.message = message;
        this.stack = (new Error()).stack;
    }

    beforeEach(function () {
        logs = [];
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

    describe('interface verification', function () {

        it('should execute simple scenario', function () {
            var transitionA = sinon.stub(),
                transitionB = sinon.stub(),
                onTermination = sinon.stub(),
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

            transitionA.returns(Promise.resolve({trigger: 'terminated'}));
            transitionB.returns(Promise.resolve({}));
            onTermination.returns(Promise.resolve({}));
            return execution.run()
                .then(function () {
                    assert(transitionA.calledOnce);
                    assert(transitionB.calledOnce);
                    assert(onTermination.calledOnce);
                    execution.getCurrentState().id.should.be.equal(scenario.states[1].id);
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
                            transition: Promise.resolve({})
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                execution = factory(scenario);

            return execution.run()
                .then(function () {
                    execution.getCurrentState().id.should.equal(scenario.states[1].id);
                });
        });

        it('should correctly handle instant .transition() result', function () {
            var transitionA = sinon.stub(),
                transitionB = sinon.stub(),
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

            transitionA.returns({trigger: 'terminated'});
            transitionB.returns({});
            return execution.run().then(function () {
                assert(transitionA.calledOnce);
                assert(transitionB.calledOnce);
            });
        });

        it('should correctly handle empty .transition() result', function () {
            var transitionA = sinon.stub(),
                transitionB = sinon.stub(),
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

            transitionA.returns({trigger: 'terminated'});
            transitionB.returns(undefined);

            return execution.run()
                .then(function () {
                    assert(transitionA.calledOnce);
                    assert(transitionB.calledOnce);
                });
        });

        it('should correctly handle different triggers', function () {
            var transitionA = sinon.stub(),
                transitionB = sinon.stub(),
                transitionC = sinon.stub(),
                transitionD = sinon.stub(),
                transitionE = sinon.stub(),
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

            transitionA.returns({trigger: 'stage-b:transitioned'});
            transitionB.returns({trigger: 'relocated'});
            transitionC.returns({trigger: {id: 'aborted', stage: 'stage-c'}});
            transitionD.returns({trigger: {id: 'terminated'}});
            transitionE.returns({});
            return execution.run().then(function () {
                assert(transitionA.calledOnce);
                assert(transitionB.calledOnce);
                assert(transitionC.calledOnce);
                assert(transitionD.calledOnce);
                assert(transitionE.calledOnce);
            });
        });

        it('should successfully execute scenario with no direct flow', function () {
            var scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true,
                            transition: function () {
                                var self = this;
                                setTimeout(function () {
                                    self.transitionTo('default', 'terminated');
                                });
                                return Promise.resolve({});
                            }
                        },
                        {
                            id: 'terminated',
                            terminal: true,
                            transition: function () {
                                return Promise.resolve({});
                            }
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                execution = factory(scenario);

            return execution.run();
        });

    });

    describe('invariants', function () {

        it('should reject scenario with failed transition', function () {
            var scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true,
                            transition: function () {
                                var self = this;
                                setTimeout(function () {
                                    self.transitionTo('default', 'terminated');
                                }, 10);
                                return Promise.reject({});
                            }
                        },
                        {
                            id: 'terminated',
                            terminal: true,
                            transition: function () {
                                return Promise.resolve({});
                            }
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                execution = factory(scenario);

            return execution.run().should.eventually.be.rejected;
        });

        it('should not reject scenario with failed abort', function () {
            var abortHandler = sinon.stub(),
                scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true,
                            transition: function () {
                                var self = this;
                                setTimeout(function () {
                                    self.transitionTo('default', 'terminated');
                                }, 10);
                                return new Promise(function () {});
                            },
                            abort: abortHandler
                        },
                        {
                            id: 'terminated',
                            terminal: true,
                            transition: function () {
                                return Promise.resolve({});
                            }
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                execution = factory(scenario);

            abortHandler.returns(Promise.reject({}));

            return execution.run().then(function () {
                assert(abortHandler.calledOnce);
            });
        });

        it('should reject scenario with failed onTermination', function () {
            var terminationHandler = sinon.stub(),
                scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true,
                            transition: function () {
                                return Promise.resolve({trigger: 'terminated'});
                            }
                        },
                        {
                            id: 'terminated',
                            terminal: true,
                            transition: function () {
                                return Promise.resolve({});
                            }
                        }
                    ],
                    onTermination: terminationHandler,
                    trigger: schema.TriggerType.Http
                },
                execution = factory(scenario);

            return execution.run().then(function () {
                assert.fail('This branch should have never been executed');
            }, function () {
                assert(terminationHandler.calledOnce);
            });
        });


        it('should pass the same hints to .transition, .abort and timeout handlers', function () {
            var initializeTransitionHandler = sinon.stub().returns(new Promise(function () {})),
                initializeAbortHandler = sinon.stub().returns(new Promise(function () {})),
                initializeAbortTimeoutHandler = sinon.stub().returns(Promise.resolve({})),
                interceptTransitionHandler = sinon.stub().returns(new Promise(function () {})),
                interceptTransitionTimeoutHandler = sinon.stub().returns(Promise.resolve({})),
                interceptTimeoutHandler = sinon.stub().returns(Promise.resolve({trigger: 'terminated'})),
                terminalTransitionHandler = sinon.stub().returns(Promise.resolve({})),
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
                                transition: 1,
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
                .then(function() {
                    return execution.getCompletionHook;
                })
                .then(function () {
                    initializeTransitionHandler.getCall(0).args[1].should.be.equal(hints);
                    initializeAbortHandler.getCall(0).args[1].should.be.equal(hints);
                    initializeAbortTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                    interceptTransitionHandler.getCall(0).args[1].should.be.equal(hints);
                    interceptTransitionTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                    assert(interceptTimeoutHandler.getCall(0));
                    interceptTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                });
        });
    });

    describe('timeouts', function () {

        describe('scenario', function () {

            it('should timeout excessively long scenario', function () {
                var transitionHandler = sinon.stub().returns(infinitePromise),
                    timeoutHandler = sinon.stub().returns(Promise.resolve({})),
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
                    assert.fail('this branch should not have been executed')
                }, function () {
                    assert(transitionHandler.calledOnce);
                    assert(timeoutHandler.calledOnce);
                });
            });


            it('should reject scenario with timed out onTermination', function () {
                var terminationHandler = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    return Promise.resolve({trigger: 'terminated'});
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        onTermination: terminationHandler,
                        trigger: schema.TriggerType.Http,
                        timeouts: {
                            onTermination: 1
                        }
                    },
                    execution = factory(scenario);

                terminationHandler.returns(new Promise(function () {}));
                return execution.run().then(function () {
                    assert.fail('This branch should have never been executed');
                }, function () {
                    assert(terminationHandler.calledOnce);
                });
            });

            it('should save scenario with timed out termination handler by rescue handler', function () {
                var terminationHandler = sinon.stub(),
                    terminationTimeoutHandler = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    return Promise.resolve({trigger: 'terminated'});
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
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

                terminationHandler.returns(new Promise(function () {}));
                terminationTimeoutHandler.returns(Promise.resolve({}));
                return execution.run().then(function () {
                    assert(terminationHandler.calledOnce);
                    assert(terminationTimeoutHandler.calledOnce);
                });
            });

            it('should reject scenario if both termination handler and rescue handler time out', function () {
                var terminationHandler = sinon.stub(),
                    terminationTimeoutHandler = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    return Promise.resolve({trigger: 'terminated'});
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
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

                terminationHandler.returns(new Promise(function () {}));
                terminationTimeoutHandler.returns(new Promise(function () {}));
                return execution.run().then(function () {
                    assert.fail('This branch should have not been executed');
                }, function () {
                    assert(terminationHandler.calledOnce);
                    assert(terminationTimeoutHandler.calledOnce);
                });
            });

        });

        describe('state', function () {

            it('should timeout excessively long state', function () {
                var transition = sinon.stub().returns(Promise.resolve({})),
                    timeoutHandler = sinon.stub().returns(Promise.resolve({trigger: 'terminated'})),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transition,
                                onTimeout: timeoutHandler,
                                timeouts: {
                                    state: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function () {
                    assert.fail('this branch should have not been executed');
                }, function () {
                    assert(transition.calledOnce);
                    assert(timeoutHandler.calledOnce);
                });
            });

            it('should save timed out state by onTimeout handler', function () {
                var rescueHandler = sinon.stub(),
                    transition = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transition,
                                onTimeout: rescueHandler,
                                timeouts: {
                                    self: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                transition.returns(new Promise(function () {}));
                rescueHandler.returns(Promise.resolve({trigger: 'terminated'}));

                execution.run().then(function () {
                    assert(transition.calledOnce);
                    assert(rescueHandler.calledOnce);
                });
            });

            it('should reject scenario in case of both state and rescue handler timeouts', function () {
                var rescueHandler = sinon.stub(),
                    transition = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transition,
                                onTimeout: rescueHandler,
                                timeouts: {
                                    self: 1,
                                    onTimeout: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                transition.returns(new Promise(function () {}));
                rescueHandler.returns(new Promise(function () {}));

                execution.run().then(function () {
                    assert.fail('this branch should have never been executed');
                }, function () {
                    assert(transition.calledOnce);
                    assert(rescueHandler.calledOnce);
                });
            });
        });

        describe('transition', function () {

            it('should reject on timed out transition with no rescue handler', function () {
                var transition = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transition,
                                timeouts: {
                                    transition: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                transition.returns(new Promise(function () {}));

                execution.run().then(function () {
                    assert.fail('this branch should have never been executed');
                }, function () {
                    assert(transition.calledOnce);
                });
            });

            it('should run rescue handler on timed out transition', function () {
                var rescueHandler = sinon.stub(),
                    transition = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transition,
                                onTransitionTimeout: rescueHandler,
                                timeouts: {
                                    transition: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                transition.returns(new Promise(function () {}));
                rescueHandler.returns(Promise.resolve({}));

                execution.run().then(function () {
                    assert(transition.calledOnce);
                    assert(rescueHandler.calledOnce);
                });
            });

            it('should reject scenario with timed out transition and rescue handler', function () {
                var rescueHandler = sinon.stub(),
                    transition = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: transition,
                                onTransitionTimeout: rescueHandler,
                                timeouts: {
                                    transition: 1,
                                    onTransitionTimeout: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                transition.returns(new Promise(function () {}));
                rescueHandler.returns(Promise.resolve({}));

                execution.run().then(function () {
                    assert.fail('this branch should have never been executed');
                }, function () {
                    assert(transition.calledOnce);
                    assert(rescueHandler.calledOnce);
                });
            });
        });

        describe('abort', function () {
            it('should run rescue handler on timed out abort', function () {
                var transitionHandler = sinon.stub().returns({}),
                    abortHandler = sinon.stub().returns(Promise.resolve({})),
                    rescueHandler = sinon.stub().returns(Promise.resolve({})),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    this.transitionTo('default', 'terminated');
                                    transitionHandler.call();
                                    return new Promise(function () {});
                                },
                                abort: abortHandler,
                                onAbortTimeout: rescueHandler,
                                timeouts: {
                                    abort: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true,
                                transition: function () {
                                    return Promise.resolve({});
                                }
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = factory(scenario);

                return execution.run().then(function () {
                    assert(transitionHandler.calledOnce);
                    assert(abortHandler.calledOnce);
                    assert(rescueHandler.calledOnce);
                });
            });
        });

    });
});