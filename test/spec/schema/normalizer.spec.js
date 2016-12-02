var Normalizer = require('../../../lib/schema/normalizer'),
    schema = require('../../../lib/schema/definitions'),
    Timeouts = schema.Timeouts,
    Directive = schema.Directive,
    TriggerType = schema.TriggerType,
    helper = require('../../helper/common'),
    chai = require('chai'),
    assert = chai.assert;

describe('/schema', function () {

    describe('/normalizer.js', function () {

        helper.setup();

        describe('.Handler', function () {

            var N = Normalizer.Handler;

            describe('.wrapHandler', function () {

                it('should substitute empty value with a function returning promise with default value', function () {
                    var defaultValue = null,
                        handler = N.wrapHandler(null, defaultValue),
                        result;

                    assert.isFunction(handler);
                    result = handler.apply();
                    assert.isFunction(result.then);
                    return result.then(function (value) {
                        assert.equal(value, defaultValue);
                    });
                });

                it('should wrap plain value into a function returning promise', function () {
                    var input = {},
                        handler = N.wrapHandler(input, null),
                        result;

                    assert.isFunction(handler);
                    result = handler.apply();
                    assert.isFunction(result.then);
                    return result.then(function (value) {
                        assert.equal(value, input);
                    });
                });

                it('should wrap function returning plain value into a promise', function () {
                    var value = {x: 12},
                        input = function () {
                            return value;
                        },
                        handler = N.wrapHandler(input, null),
                        result;

                    assert.isFunction(handler);
                    result = handler.apply();
                    assert.isFunction(result.then);
                    return result.then(function (v) {
                        assert.equal(v, value);
                    });
                });

                it('should insensibly wrap function returning promise', function () {
                    var value = {x: 12},
                        input = function () {
                            return Promise.resolve(value);
                        },
                        handler = N.wrapHandler(input, null),
                        result;

                    assert.isFunction(handler);
                    result = handler.apply();
                    assert.isFunction(result.then);
                    return result.then(function (v) {
                        assert.equal(value, v);
                    });
                });

                it('should propagate exception', function () {
                    var error = new Error(),
                        input = function () {
                            throw error;
                        },
                        handler = N.wrapHandler(input, null),
                        result;

                    assert.isFunction(handler);
                    result = handler.apply();
                    assert.isFunction(result.then);
                    return result.then(helper.restrictedBranchHandler, function (e) {
                        assert.equal(e, error);
                    });
                });

                it('should propagate rejection', function () {
                    var error = new Error(),
                        input = function () {
                            return Promise.reject(error);
                        },
                        handler = N.wrapHandler(input, null),
                        result;

                    assert.isFunction(handler);
                    result = handler.apply();
                    assert.isFunction(result.then);
                    return result.then(helper.restrictedBranchHandler, function (e) {
                        assert.equal(e, error);
                    });
                });
            });

            describe('.stateAction', function () {

                it('should return empty directive by default', function () {
                    return N.stateAction().call().then(function (value) {
                        assert.instanceOf(value, Directive);
                    });
                });

                it('should normalize returned directive', function () {
                    var trigger = '4th grade',
                        transitionedTo = '3rd grade',
                        input = {trigger: trigger, transitionedTo: transitionedTo};

                    return N.stateAction(input).call().then(function (directive) {
                        assert.equal(directive.transitionedTo, transitionedTo);
                        assert.equal(directive.trigger.id, trigger);
                    });
                });

                it('should fill missing transitionedTo', function () {
                    var override = 'dummy';

                    return N.stateAction({}, override).call().then(function (directive) {
                        assert.equal(directive.transitionedTo, override);
                    });
                });

                it('should not override existing transitionedTo', function () {
                    var original = 'nifty',
                        override = 'dummy';

                    return N.stateAction({transitionedTo: original}, override).call().then(function (directive) {
                        assert.equal(directive.transitionedTo, original);
                    });
                })

            });

            describe('.stateActionTimeout', function () {

                it('should reject with passed error by default', function () {
                    var handler = N.stateActionTimeout(),
                        error = new Error(),
                        promise = handler.call(null, null, null, null, error);

                    return promise.then(helper.restrictedBranchHandler, function (e) {
                        assert.equal(e, error);
                    });
                });

                it('should normalize passed directive', function () {
                    var destination = 'destination',
                        handler = N.stateActionTimeout({transitionedTo: destination});

                    return handler.call().then(function (directive) {
                        assert.equal(directive.transitionedTo, destination);
                        assert.isNull(directive.trigger);
                    });
                });

            });

            describe('.stateTimeout', function () {

                it('should resolve with empty object by default', function () {
                    return N.stateTimeout().call().then(function (result) {
                        return assert.deepEqual(result, {});
                    });
                });

            });

            describe('.onTermination', function () {

                it('should resolve with empty object by default', function () {
                    return N.onTermination().call().then(function (result) {
                        return assert.deepEqual(result, {});
                    });
                });

            });

            describe('.onTerminationTimeout', function () {

                it('should reject with passed error by default', function () {
                    var handler = N.onTerminationTimeout(),
                        error = new Error(),
                        promise = handler.call(null, null, error);

                    return promise.then(helper.restrictedBranchHandler, function (e) {
                        assert.equal(e, error);
                    });
                });


            });

        });

        describe('.Schema', function () {

            var N = Normalizer.Schema;

            describe('.state', function () {

                it('should substitute missing handlers', function () {
                    var normalized = N.state({});

                    assert.isFunction(normalized.transition);
                    assert.isFunction(normalized.onTransitionTimeout);
                    assert.isFunction(normalized.abort);
                    assert.isFunction(normalized.onAbortTimeout);
                    assert.isFunction(normalized.onTimeout);
                });

                it('should set entrypoint and terminal flags', function () {
                    var normalized = N.state({});

                    assert.isFalse(normalized.terminal);
                    assert.isFalse(normalized.entrypoint);
                });

            });

            describe('.scenario', function () {

                it('should nullify invalid trigger', function () {
                    var normalized = N.scenario({trigger: 'None'});

                    assert.isNull(normalized.trigger);
                });

                it('should pass valid trigger', function () {
                    var normalized = N.scenario({trigger: TriggerType.Http});

                    assert.equal(normalized.trigger, TriggerType.Http);
                });

                it('should create missing handler dummies', function () {
                    var normalized = N.scenario({});

                    assert.isFunction(normalized.onTermination);
                    assert.isFunction(normalized.onTerminationTimeout);
                });

                it('should normalize timeouts', function () {
                    var timeout = 15 * 1000,
                        normalized = N.scenario({timeouts:{state: timeout}});

                    assert.equal(normalized.timeouts.state, timeout);
                });

                it('should use default timeouts', function () {
                    var normalized = N.scenario();

                    assert.isNumber(normalized.timeouts.transition);
                });

                it('should use scenario timeouts for states', function () {
                    var timeout = 15 * 1000,
                        normalized = N.scenario({states: [{id: 'dummy'}], timeouts:{state: timeout}});

                    assert.equal(normalized.states[0].timeouts.state, timeout);
                });
            });

            describe('.timeouts', function () {

                it('should correctly normalize null', function () {
                    var timeouts = N.timeouts(null);

                    assert.instanceOf(timeouts, Timeouts);
                    assert.notOk(timeouts.hasOwnProperty('state'));
                });

                it('should correctly normalize object', function () {
                    var timeout = 15 * 1000,
                        timeouts = N.timeouts({state: timeout});

                    assert.notOk(timeouts.hasOwnProperty('scenario'));
                    assert.equal(timeouts.state, timeout);
                });

            });

            describe('.directive', function () {

                it('should correctly normalize null', function () {
                    var normalized = N.directive(null);

                    assert.equal(normalized.transitionedTo, null);
                    assert.equal(normalized.trigger, null);
                });

                it('should correctly normalize full structure', function () {
                    var directive = {
                            transitionedTo: 'lighthouse',
                            trigger: {
                                id: 'rapture',
                                hints: {x: 12}
                            }
                        },
                        normalized = N.directive(directive);

                    assert.equal(normalized.transitionedTo, directive.transitionedTo);
                    assert.deepEqual(normalized.trigger, directive.trigger);
                });

                it('should correctly normalize string trigger', function () {
                    var transitionedTo = 'narnia',
                        trigger = 'wardrobe',
                        normalized = N.directive({transitionedTo: transitionedTo, trigger: trigger});

                    assert.equal(normalized.transitionedTo, transitionedTo);
                    assert.equal(normalized.trigger.id, trigger);
                    assert.lengthOf(Object.keys(normalized.trigger.hints), 0);
                });
            });

            describe('.trigger', function () {

                it('should normalize null as null', function () {
                    assert.isNull(N.trigger(null));
                });

                it('should normalize string', function () {
                    var id = 'dummy',
                        trigger = N.trigger(id);

                    assert.equal(trigger.id, id);
                    assert.deepEqual(trigger.hints, {});
                });

                it('should normalize structure with hints', function () {
                    var id = 'dummy',
                        hints = {x: 12},
                        trigger = N.trigger({id: id, hints: hints});

                    assert.equal(trigger.id, id);
                    assert.deepEqual(trigger.hints, hints);
                });

            });

        });

    });

});