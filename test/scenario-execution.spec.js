var ScenarioExecution = require('../lib/scenario-execution').ScenarioExecution,
    schema = require('../lib/schema'),
    concurrent = require('../lib/utility/concurrent'),
    chai = require('chai'),
    assert = chai.assert,
    chaiAsPromised = require('chai-as-promised'),
    sinon = require('sinon');

chai.use(chaiAsPromised);

function TestingException(message) {
    this.name = 'TestingException';
    this.message = message;
    this.stack = (new Error()).stack;
}

// todo: not good

//noinspection JSUnusedGlobalSymbols,JSUnusedGlobalSymbols
global.VoxEngine = {
    terminate: function () {},
    customData: function () { return ''; }
};

describe('scenario-execution', function () {

    describe('interface verification', function () {

        it('should execute simple scenario', function () {
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
                execution = new ScenarioExecution(scenario);

            transitionA.returns(Promise.resolve({trigger: 'terminated'}));
            transitionB.returns(Promise.resolve({}));
            return execution.run()
                .then(function () {
                    assert(transitionA.calledOnce);
                    assert(transitionB.calledOnce);
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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

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
                execution = new ScenarioExecution(scenario);

            return execution.run().then(function () {
                assert.fail('This branch should have never been executed');
            }, function () {
                assert(terminationHandler.calledOnce);
            });
        });


        it('should pass the same hints to .transition, .abort and timeout handlers', function () {
            var transitionHandler = sinon.stub(),
                abortHandler = sinon.stub(),
                interceptTransitionTimeoutHandler = sinon.stub(),
                abortTimeoutHandler = sinon.stub(),
                timeoutHandler = sinon.stub(),
                interceptTransitionHandler = sinon.stub(),
                hints = {x: 12},
                scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true,
                            transition: transitionHandler,
                            abort: abortHandler,
                            onAbortTimeout: abortTimeoutHandler,
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
                            onTimeout: timeoutHandler,
                            timeouts: {
                                self: 1,
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
                execution = new ScenarioExecution(scenario);

            transitionHandler.returns(new Promise(function () {}));
            abortHandler.returns(new Promise(function () {}));
            abortTimeoutHandler.returns(Promise.resolve({}));
            interceptTransitionHandler.returns(new Promise(function () {}));
            interceptTransitionTimeoutHandler.returns(new Promise(function () {}));
            timeoutHandler.returns(Promise.resolve({trigger: 'terminated'}));

            execution.transitionTo('default', 'initialized', hints);

            return execution.transitionTo('default', 'intercept', hints)
                .then(function() {
                    return execution.getCompletionHook;
                })
                .then(function () {
                    transitionHandler.getCall(0).args[1].should.be.equal(hints);
                    abortHandler.getCall(0).args[1].should.be.equal(hints);
                    abortTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                    interceptTransitionHandler.getCall(0).args[1].should.be.equal(hints);
                    interceptTransitionTimeoutHandler.getCall(0).args[1].should.be.equal(hints);
                    timeoutHandler.getCall(0).args[1].should.be.equal(hints);
                });
        });
    });

    describe('timeouts', function () {

        describe('scenario', function () {

            it('should timeout excessively long scenario', function () {
                var scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    return new Promise(function () {});
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true
                            }
                        ],
                        trigger: schema.TriggerType.Http,
                        timeouts: {
                            self: 1
                        }
                    },
                    execution = new ScenarioExecution(scenario);

                return execution.run().should.eventually.be.rejected;
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
                    execution = new ScenarioExecution(scenario);

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
                    execution = new ScenarioExecution(scenario);

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
                    execution = new ScenarioExecution(scenario);

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

            it('should time out excessively long state', function () {
                var scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    return new Promise(function () {});
                                },
                                timeouts: {
                                    self: 1
                                }
                            },
                            {
                                id: 'terminated',
                                terminal: true
                            }
                        ],
                        trigger: schema.TriggerType.Http
                    },
                    execution = new ScenarioExecution(scenario);

                return execution.run().should.eventually.be.rejected;
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
                        ]
                    },
                    execution = new ScenarioExecution(scenario);

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
                        ]
                    },
                    execution = new ScenarioExecution(scenario);

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
                        ]
                    },
                    execution = new ScenarioExecution(scenario);

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
                        ]
                    },
                    execution = new ScenarioExecution(scenario);

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
                        ]
                    },
                    execution = new ScenarioExecution(scenario);

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
                var rescueHandler = sinon.stub(),
                    scenario = {
                        states: [
                            {
                                id: 'initialized',
                                entrypoint: true,
                                transition: function () {
                                    this.transitionTo('default', 'terminated');
                                    return new Promise(function () {});
                                },
                                abort: function () {
                                    return new Promise(function () {});
                                },
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
                    execution = new ScenarioExecution(scenario);

                rescueHandler.returns(Promise.resolve({}));
                return execution.run().then(function () {
                    assert(rescueHandler.calledOnce);
                });
            });
        });

    });
});