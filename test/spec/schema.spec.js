var schema = require('../../lib/schema'),
    concurrent = require('../../lib/utility/concurrent'),
    TimeoutException = concurrent.TimeoutException,
    CancellationToken = concurrent.CancellationToken,
    chai = require('chai'),
    expect = chai.expect,
    assert = chai.assert;

chai.should();

describe('/schema.js', function () {

    describe('.normalizeState', function () {
        
        it('should normalize entrypoint', function () {
            schema.normalizeState({id: 'id'}).should.have.property('entrypoint', false);
        });
        
        it('should normalize terminal property', function () {
            schema.normalizeState({id: 'id'}).should.have.property('terminal', false);
        });
        
        it('should correctly wrap undefined transition', function () {
            var state = schema.normalizeState({id: 'id'});

            return state.transition.call()
                .then(function (value) {
                    assert.instanceOf(value, schema.Directive);
                    assert.equal(value.trigger.id, null);
                    assert.deepEqual(value.trigger.hints, {});
                    assert.equal(value.transitionedTo, null);
                    assert.property(value, 'trigger');
                    assert.equal(value.trigger.id, null);
                    assert.property(value, 'transitionedTo');
                    assert.equal(value.transitionedTo, null);
                });
        });

        it('should correctly wrap value transition', function () {
            var transition = {hints: 42},
                state = schema.normalizeState({id: 'id', transition: transition});

            return state.transition.call()
                .then(function (value) {
                    expect(value).to.exist;
                    expect(value).to.be.equal(value);
                });
        });

        it('should correctly wrap Promise transition', function () {
            var transition = Promise.resolve({hints: 42}),
                state = schema.normalizeState({id: 'id', transition: transition});

            return state.transition.call()
                .then(function (value) {
                    expect(value).to.exist;
                    expect(value).to.be.equal(value);
                });
        });

        it('should set up .onTransitionTimeout handler', function () {
            var state = schema.normalizeState({id: 'id'}),
                error = new TimeoutException('Testing exception flow');

            return state.onTransitionTimeout.call(null, null, null, new CancellationToken(), error)
                .then(function () {
                    assert.fail('this branch should have never been executed');
                }, function (e) {
                    e.should.be.equal(error);
                });
        });

        it('should set up .abort handler', function () {
            var state = schema.normalizeState({id: 'id'});

            return state.abort.call(null, null, null, new CancellationToken());
        });

        it('should set up .onAbortTimeout handler', function () {
            var state = schema.normalizeState({id: 'id'}),
                error = new TimeoutException('Testing exception flow');

            return state.onAbortTimeout.call(null, null, null, null, error)
                .then(function () {
                    assert.fail('this branch should have never been executed');
                }, function (e) {
                    e.should.be.equal(error);
                });
        });

        it('should set up .onTimeout handler', function () {
            var error = new TimeoutException('Testing exception flow'),
                state = schema.normalizeState({id: 'id'});

            return state.onTimeout.call(null, null, null, null, error)
                .then(function () {
                    assert.fail('this branch should have never been executed');
                }, function (e) {
                    e.should.be.equal(error);
                });
        });

    });

    describe('.normalizeScenario', function () {
        it('should fully normalize scenario', function () {
            var raw = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                scenario = schema.normalizeScenario(raw);

            scenario.onTermination.should.be.instanceof(Function);
            scenario.onTerminationTimeout.should.be.instanceof(Function);
            expect(scenario.timeouts).to.exist;
            expect(scenario.schemaVersion).to.exist;
            expect(scenario.states).to.exist;

            scenario.states[0].entrypoint.should.be.equal(true);
            scenario.states[0].terminal.should.be.equal(false);
            scenario.states[0].transition.should.be.instanceof(Function);
            scenario.states[0].onTransitionTimeout.should.be.instanceof(Function);
            scenario.states[0].abort.should.be.instanceof(Function);
            scenario.states[0].onAbortTimeout.should.be.instanceof(Function);
            scenario.states[0].onTimeout.should.be.instanceof(Function);

            scenario.states[1].entrypoint.should.be.equal(false);
        });

        it('should wrap fixed onTermination value', function () {
            var raw = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http,
                    onTermination: {hints: 12}
                },
                scenario = schema.normalizeScenario(raw);

            expect(scenario.onTermination).to.be.instanceof(Function);
        });
    });

    describe('.normalizeDirective', function () {

        it('should correctly normalize null', function () {
            var result = schema.normalizeDirective(null);

            result.should.have.property('trigger', null);
            result.should.have.property('transitionedTo', null);
            result.termination.should.have.property('hints');
            result.termination.hints.should.be.deep.equal({});
        });


        it('should correctly normalize full directive', function () {
            var raw = {
                    termination: {
                        hints: {x: 12}
                    },
                    trigger: 'terminated',
                    transitionedTo: 'initialized'
                },
                directive = schema.normalizeDirective(raw);

            directive.should.have.property('trigger');
            directive.trigger.should.have.property('id', raw.trigger);
            directive.trigger.should.have.property('hints');
            directive.trigger.hints.should.be.deep.equal({});
            directive.should.have.property('transitionedTo', raw.transitionedTo);
            directive.should.have.property('termination');
            directive.termination.should.have.property('hints', raw.termination.hints);
        });

    });

    describe('.normalizeTrigger', function () {
        it('should correctly normalize null', function () {
            var trigger = schema.normalizeTrigger(null);

            assert.equal(trigger.id, null);
            assert.deepEqual(trigger.hints, {});
        });

        it('should correctly normalize string', function () {
            var raw = 'terminated',
                trigger = schema.normalizeTrigger(raw);

            assert.equal(trigger.id, raw);
            assert.deepEqual(trigger.hints, {});
        });

        it('should correctly normalize full trigger definition', function () {
            var raw = {
                    id: 'terminated',
                    hints: {x: 19}
                },
                trigger = schema.normalizeTrigger(raw);

            assert.equal(trigger.id, raw.id);
            assert.equal(trigger.hints, raw.hints);
        });
    });

    describe('.validateScenario', function () {
        it('should report missing entrypoint', function () {
            var scenario = {
                    states: [
                        {
                            id: 'id',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.states.should.exist;
            validationResult.violations.states.should.not.be.empty;
        });

        it('should report multiple entrypoints', function () {
            var scenario = {
                    states: [
                        {
                            id: 'id',
                            entrypoint: true
                        },
                        {
                            id: 'initialized',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.states.should.exist;
            validationResult.violations.states.should.not.be.empty;
        });

        it('should report missing terminal state', function () {
            var scenario = {
                    states: [
                        {
                            id: 'id',
                            entrypoint: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.states.should.exist;
            validationResult.violations.states.should.not.be.empty;
        });

        it('should report overlapping states', function () {
            var scenario = {
                    states: [
                        {
                            id: 'id',
                            entrypoint: true
                        },
                        {
                            id: 'id',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.should.have.property('states.id');
            validationResult.violations['states.id'].should.exist;
            validationResult.violations['states.id'].should.not.be.empty;
        });

        it('should report unknown trigger', function () {
            var scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            stage: 'stage',
                            terminal: true
                        }
                    ],
                    trigger: 'unknown'
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.should.have.property('trigger');
            validationResult.violations.trigger.should.not.be.empty;
        });

        it('should report missing trigger', function () {
            var scenario = {
                    states: [
                        {
                            id: 'initialized',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            stage: 'stage',
                            terminal: true
                        }
                    ]
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.should.have.property('trigger');
            validationResult.violations.trigger.should.not.be.empty;
        });

        it('should successfully validate correct scenario', function () {
            var scenario = {
                    states: [
                        {
                            id: 'entrypoint',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.true;
            validationResult.violations.should.be.empty;
        });

        it('should report missing state id', function () {
            var scenario = {
                    states: [
                        {
                            id: null,
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.states.should.not.be.empty;
        });

        it('should report empty state id', function () {
            var scenario = {
                    states: [
                        {
                            id: '',
                            entrypoint: true
                        },
                        {
                            id: 'terminated',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.states.should.not.be.empty;
        });
    });
});