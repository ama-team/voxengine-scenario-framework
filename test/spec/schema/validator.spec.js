var validator = require('../../../lib/schema/validator'),
    schema = require('../../../lib/schema/definitions'),
    helper = require('../../helper/common'),
    chai = require('chai'),
    assert = chai.assert;

describe('/schema', function () {
    var stateFactory = function (id, entrypoint, terminal) {
            return {
                id: id || 'dummy',
                entrypoint: typeof entrypoint === 'undefined' ? true : !!entrypoint,
                terminal: typeof terminal === 'undefined' ? true : !!terminal,
                transition: helper.resolved,
                onTransitionTimeout: helper.resolved,
                abort: helper.resolved,
                onAbortTimeout: helper.resolved,
                onTimeout: helper.resolved,
                timeouts: {}
            };
        },
        scenarioFactory = function (states) {
            return {
                id: 'dummy',
                version: '0.1.0',
                environment: 'testing',
                states: states || [],
                onTermination: helper.resolved,
                onTerminationTimeout: helper.resolved,
                trigger: schema.TriggerType.Http,
                timeouts: {}
            }
        };
    describe('/validator.js', function () {
        var dumper = function (result) {
            allure.createAttachment('validation-result.json', JSON.stringify(result, null, 2), 'application/json');
            return result;
        };

        helper.setup();

        describe('.validate', function () {
            it('should not complain on valid scenario', function () {
                var scenario = scenarioFactory([stateFactory()]),
                    result = dumper(validator.validate(scenario));

                assert(result.valid);
                assert.lengthOf(Object.keys(result.violations), 0);
            });

            it('should notice missing scenario id', function () {
                var scenario = scenarioFactory([stateFactory()]),
                    result;

                scenario.id = null;
                result = dumper(validator.validate(scenario));

                assert(result.valid);
                assert(result.violations.id);
            });

            it('should notice missing scenario version', function () {
                var scenario = scenarioFactory([stateFactory()]),
                    result;

                scenario.version = null;
                result = dumper(validator.validate(scenario));

                assert(result.valid);
                assert(result.violations.version);
            });

            it('should notice missing scenario environment', function () {
                var scenario = scenarioFactory([stateFactory()]),
                    result;

                scenario.environment = null;
                result = dumper(validator.validate(scenario));

                assert(result.valid);
                assert(result.violations.environment);
            });

            it('should block on missing scenario onTermination handler', function () {
                var scenario = scenarioFactory([stateFactory()]),
                    result;

                scenario.onTermination = null;
                result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations.onTermination);
            });

            it('should block on missing scenario onTerminationTimeout handler', function () {
                var scenario = scenarioFactory([stateFactory()]),
                    result;

                scenario.onTerminationTimeout = null;
                result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations.onTerminationTimeout);
            });

            it('should block on missing scenario states', function () {
                var scenario = scenarioFactory(),
                    result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations.states);
            });

            it('should block on missing scenario entrypoint', function () {
                var scenario = scenarioFactory([stateFactory(null, false)]),
                    result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations.states);
            });

            it('should block on multiple scenario entrypoints', function () {
                var scenario = scenarioFactory([stateFactory('alpha'), stateFactory('beta')]),
                    result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations.states);
            });

            it('should block on missing scenario terminal state', function () {
                var scenario = scenarioFactory([stateFactory(null, true, false)]),
                    result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations.states);
            });

            it('should block on multiple states with same id', function () {
                var scenario = scenarioFactory([stateFactory('id'), stateFactory('id', false)]),
                    result = dumper(validator.validate(scenario));

                assert(!result.valid);
                assert(result.violations['states.id']);
            });

        });

        describe('.validateState', function () {
            var factory = function () {
                return {
                    id: 'investigated',
                    entrypoint: true,
                    terminal: true,
                    transition: helper.resolved,
                    onTransitionTimeout: helper.resolved,
                    abort: helper.resolved,
                    onAbortTimeout: helper.resolved,
                    onTimeout: helper.resolved,
                    timeouts: {}
                };
            };

            it('should not complain on valid state', function () {
                var result = validator.validateState(factory());
                assert(result.valid);
                assert.lengthOf(Object.keys(result.violations), 0);
            });

            it('should report missing handlers', function () {
                var handlers = ['transition', 'onTransitionTimeout', 'abort', 'onAbortTimeout', 'onTimeout'],
                    callback = function (handler) {
                        var state = factory(),
                            result;
                        state[handler] = null;
                        result = dumper(validator.validateState(state));
                        assert(!result.valid);
                        assert(result.violations[handler]);
                    };
                handlers.forEach(allure.createStep('Asserting handler {0} validation presence', callback));
            });

            it('should report missing id', function () {
                var state = factory(),
                    result;

                state.id = null;
                result = dumper(validator.validateState(state));

                assert(!result.valid);
                assert(result.violations.id);
            });

            it('should report missing timeouts', function () {
                var state = factory(),
                    result;

                state.timeouts = null;
                result = dumper(validator.validateState(state));

                assert(!result.valid);
                assert(result.violations.timeouts);
            });
        });
    });
});
