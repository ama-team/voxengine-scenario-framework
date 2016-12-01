var schema = require('./../schema/definitions'),
    Defaults = schema.Defaults,
    TriggerType = schema.TriggerType,
    utilities = require('./../utility/common'),
    objects = utilities.objects;

var N = {
    Handler: {
        wrapHandler: function (handler, _default) {
            var _handler = handler || _default;
            handler = objects.isFunction(_handler) ? _handler : function () { return _handler; };
            return function () {
                try {
                    return Promise.resolve(handler.apply(this, arguments));
                } catch (e) {
                    return Promise.reject(e);
                }
            }
        },
        postProcess: function (handler, processor) {
            return function () { return processor.call(this, handler.apply(this, arguments)); }
        },
        postProcessPromise: function (handler, processor) {
            return N.Handler.postProcess(handler, function (p) { return p.then(processor); });
        },
        postProcessDirective: function (handler, id) {
            return N.Handler.postProcessPromise(handler, function(d) {
                return N.Schema.directive(d, id);
            });
        },
        stateAction: function (handler, stateId) {
            handler = N.Handler.wrapHandler(handler, {});
            return N.Handler.postProcessDirective(handler, stateId);
        },
        stateActionTimeout: function (handler, stateId) {
            handler = N.Handler.wrapHandler(handler, function (s, h, t, e) { return Promise.reject(e); });
            return N.Handler.postProcessDirective(handler, stateId);
        },
        stateTimeout: function (handler) {
            return N.Handler.wrapHandler(handler, {})
        },
        onTermination: function (handler) {
            return N.Handler.wrapHandler(handler, {});
        },
        onTerminationTimeout: function (handler) {
            return N.Handler.wrapHandler(handler, function (t, e) { return Promise.reject(e); });
        }
    },
    Schema: {
        state: function (state) {
            var s = new schema.State();
            Object.keys(s).forEach(function (k) {
                s[k] = state[k];
            });
            s.entrypoint = !!state.entrypoint;
            s.terminal = !!state.terminal;
            s.timeouts = new schema.Timeouts(state.timeouts);
            s.transition = N.Handler.stateAction(state.transition, s.id);
            s.onTransitionTimeout = N.Handler.stateActionTimeout(state.onTransitionTimeout, s.id);
            s.abort = N.Handler.stateAction(state.abort, s.id);
            s.onAbortTimeout = N.Handler.stateActionTimeout(state.onAbortTimeout, s.id);
            s.onTimeout = N.Handler.stateTimeout(state.onTimeout);
            return s;
        },
        scenario: function (scenario) {
            scenario = scenario || {};
            var s = new schema.Scenario();
            Object.keys(s).forEach(function (k) {
                s[k] = scenario[k];
            });
            s.timeouts = new schema.Timeouts(Defaults.Timeouts).fill(scenario.timeouts);
            s.trigger = null;
            Object.keys(TriggerType)
                .filter(function (k) {
                    return scenario.trigger && TriggerType[k].toLowerCase() === scenario.trigger.toLowerCase();
                })
                .forEach(function (k) {
                    s.trigger = TriggerType[k];
                });
            s.states = (scenario.states || []).map(function (st) {
                st.timeouts = s.timeouts.copy().fill(st.timeouts);
                return N.Schema.state(st);
            });
            s.onTermination = N.Handler.onTermination(scenario.onTermination);
            s.onTerminationTimeout = N.Handler.onTerminationTimeout(scenario.onTerminationTimeout);
            return s;
        },
        timeouts: function (timeouts) {
            return new schema.Timeouts(timeouts);
        },
        directive: function (directive, defaultId) {
            directive = directive || {};
            return new schema.Directive(directive.transitionedTo || defaultId, N.Schema.trigger(directive.trigger));
        },
        trigger: function (trigger) {
            if (!trigger) {
                return null;
            }
            if (objects.isString(trigger)) {
                return new schema.Trigger(trigger);
            }
            return new schema.Trigger(trigger.id || null, trigger.hints);
        }
    }
};

exports = module.exports = N;
