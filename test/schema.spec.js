var schema = require('../lib/schema'),
    concurrent = require('../lib/utility/concurrent'),
    chai = require('chai'),
    expect = chai.expect,
    assert = chai.assert;

chai.should();

function FakeCancellationToken() {
    this.isCancelled = function () {
        return false;
    }
}

function TestingException() {

}

describe('schema', function () {
    describe('.normalizeStateId', function () {
        it('should read `stage:id` string', function () {
            var normalized = schema.normalizeStateId('stage:id');
            normalized.should.have.property('stage', 'stage');
            normalized.should.have.property('id', 'id');
        });

        it('should read `:id` string', function () {
            var normalized = schema.normalizeStateId(':id');
            normalized.should.have.property('stage', 'default');
            normalized.should.have.property('id', 'id');
        });

        it('should read `id` string', function () {
            var normalized = schema.normalizeStateId('id');
            normalized.should.have.property('stage', 'default');
            normalized.should.have.property('id', 'id');
        });

        it('should read null id from `stage:` string', function () {
            var normalized = schema.normalizeStateId('stage:');
            normalized.should.have.property('stage', 'stage');
            normalized.should.have.property('id', null);
        });

        it('should read stage and id from `{id: "stage:id"}`', function () {
            var normalized = schema.normalizeStateId({id: 'stage:id'});
            normalized.should.have.property('stage', 'stage');
            normalized.should.have.property('id', 'id');
        });

        it('should throw on null as argument', function () {
            expect(function () {
                schema.normalizeStateId(undefined);
            }).throw(Object)
        });
    });

    describe('.normalizeState', function () {
        it('should set default timeouts', function () {
            var timeouts = {
                    self: 42,
                    transition: 42,
                    abort: 42
                },
                normalized = schema.normalizeState({id: 'id'}, timeouts);
            normalized.should.have.property('timeouts');
            normalized.timeouts.should.have.property('self', 42);
            normalized.timeouts.should.have.property('transition', 42);
            normalized.timeouts.should.have.property('abort', 42);
        });

        it('should not override existing timeouts', function () {
            var timeouts = {
                    self: 42,
                    transition: 42,
                    abort: 42
                },
                state = {
                    id: 'id',
                    timeouts: {
                        self: 142,
                        transition: 142,
                        abort: 142
                    }
                };
                normalized = schema.normalizeState(state, timeouts);

            normalized.should.have.property('timeouts');
            normalized.timeouts.should.have.property('self', 142);
            normalized.timeouts.should.have.property('transition', 142);
            normalized.timeouts.should.have.property('abort', 142);
        });

        it('should correctly read `stage:id` id', function () {
            var state = { id: 'stage:id' },
                normalized = schema.normalizeState(state, {});

            normalized.should.have.property('id', 'id');
            normalized.should.have.property('stage', 'stage');
        });

        it('should set default stage if stage is missing', function () {
            schema.normalizeState({id: 'id'}, {}).should.have.property('stage', 'default');
        });
        
        it('should normalize entrypoint', function () {
            schema.normalizeState({id: 'id'}).should.have.property('entrypoint', false);
        });
        
        it('should normalize terminal property', function () {
            schema.normalizeState({id: 'id'}).should.have.property('terminal', false);
        });
        
        it('should correctly wrap undefined transition', function () {
            var promise = schema.normalizeState({id: 'id'}).transition.call();
            expect(promise).to.be.instanceof(Promise);
            expect(promise.then).to.be.instanceof(Function);
            return promise.then(function (value) {
                expect(value).to.exist;
                expect(value).to.be.empty;
            })
        });

        it('should correctly wrap value transition', function () {
            var transition = {hints: 42},
                promise = schema.normalizeState({id: 'id', transition: transition}).transition.call();
            expect(promise).to.be.instanceof(Promise);
            expect(promise.then).to.be.instanceof(Function);
            return promise.then(function (value) {
                expect(value).to.exist;
                expect(value).to.be.equal(value);
            })
        });

        it('should correctly wrap Promise transition', function () {
            var transition = Promise.resolve({hints: 42}),
                promise = schema.normalizeState({id: 'id', transition: transition}).transition.call();
            expect(promise).to.be.instanceof(Promise);
            expect(promise.then).to.be.instanceof(Function);
            return promise.then(function (value) {
                expect(value).to.exist;
                expect(value).to.be.equal(value);
            })
        });

        it('should set up .onTransitionTimeout handler', function () {
            var state = schema.normalizeState({id: 'id'}),
                error = new TestingException(),
                promise;

            assert(state.onTransitionTimeout);
            state.onTransitionTimeout.should.be.instanceof(Function);
            promise = state.onTransitionTimeout.call(null, null, null, new FakeCancellationToken(), error);
            promise.should.be.instanceof(Promise);
            return promise.then(function () {
                assert.fail('this branch should have never been executed');
            }, function (e) {
                e.should.be.equal(error);
            });
        });

        it('should set up .abort handler', function () {
            var state = schema.normalizeState({id: 'id'}),
                promise;

            assert(state.abort);
            state.abort.should.be.instanceof(Function);
            promise = state.abort.call(null, null, null, new FakeCancellationToken());
            promise.should.be.instanceof(Promise);
            return promise;
        });

        it('should set up .onAbortTimeout handler', function () {
            var state = schema.normalizeState({id: 'id'}),
                error = new TestingException(),
                promise;

            assert(state.onAbortTimeout);
            state.onAbortTimeout.should.be.instanceof(Function);
            promise = state.onAbortTimeout.call(null, null, null, null, error);
            promise.should.eventually.be.instanceof(Promise);
            return promise.then(function () {
                assert.fail('this branch should have never been executed');
            }, function (e) {
                e.should.be.equal(error);
            });
        });

        it('should set up .onTimeout handler', function () {
            var state = schema.normalizeState({id: 'id'}),
                error = new TestingException(),
                promise;

            assert(state.onTimeout);
            state.onTimeout.should.be.instanceof(Function);
            promise = state.onTimeout.call(null, null, null, null, error);
            promise.should.eventually.be.instanceof(Promise);
            return promise.then(function () {
                assert.fail('this branch should have never been executed');
            }, function (e) {
                e.should.be.equal(error);
            });
        });
    });

    describe('.normalizeScenario', function () {
        it('should fully normalize scenario', function () {

        });

        it('should wrap undefined onTermination handler', function () {

        });

        it('should wrap fixed onTermination value', function () {

        });

        it('should wrap defined onTermination handler', function () {

        })
    });

    describe('.validateScenario', function () {
        it('should report missing entrypoint', function () {
            var scenario = {
                    states: [
                        {
                            id: 'stage:id',
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
                            id: 'stage:id',
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
                            id: 'stage:id',
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
                            id: 'stage:id',
                            entrypoint: true
                        },
                        {
                            id: 'id',
                            stage: 'stage',
                            terminal: true
                        }
                    ],
                    trigger: schema.TriggerType.Http
                },
                validationResult = schema.validateScenario(scenario);

            validationResult.valid.should.be.false;
            validationResult.violations.should.not.be.empty;
            validationResult.violations.should.have.property('states.stage.id');
            validationResult.violations['states.stage.id'].should.exist;
            validationResult.violations['states.stage.id'].should.not.be.empty;
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
    })
});