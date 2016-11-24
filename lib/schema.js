var utilities = require('./utility/common'),
    /**
     * @enum
     * @readonly
     */
    TriggerType = {
        Call: 'Call',
        Http: 'Http'
    },
    /**
     * @enum
     * @readonly
     */
    TerminationStatus = {
        Completion: 'Completion',
        ScenarioTimeout: 'ScenarioTimeout',
        TransitionTimeout: 'TransitionTimeout',
        TransitionFailure: 'TransitionFailure',
        StateTimeout: 'StateTimeout',
        UnexpectedException: 'UnexpectedException'
    },
    Defaults = {
        Schema: {
            Version: 'v0.1'
        },
        State: {
            Handler: function () {
                return Promise.resolve({});
            },
            RescueHandler: function (previousState, hints, cancellationToken, error) {
                return Promise.reject(error);
            }
        },
        Scenario: {
            TerminationHandler: function () {
                return Promise.resolve({});
            },
            TerminationTimeoutHandler: function (hints, token, error) {
                return Promise.reject(error);
            }
        },
        Timeouts: {
            scenario: null,
            onScenarioTimeout: 15 * 1000,
            state: null,
            onTermination: 15 * 1000,
            onTerminationTimeout: 15 * 1000,
            transition: 45 * 1000,
            onTransitionTimeout: 15 * 1000,
            abort: 30 * 1000,
            onAbortTimeout: 15 * 1000,
            onStateTimeout: 15 * 1000
        }
    };

/**
 * @class Timeouts
 *
 * @property {number|undefined|null} scenario
 * @property {number|undefined|null} onScenarioTimeout
 * @property {number|undefined|null} state
 * @property {number|undefined|null} onStateTimeout
 * @property {number|undefined|null} transition
 * @property {number|undefined|null} onTransitionTimeout
 * @property {number|undefined|null} abort
 * @property {number|undefined|null} onAbortTimeout
 * @property {number|undefined|null} onTermination
 * @property {number|undefined|null} onTerminationTimeout
 */

/**
 * @class ScenarioDeclaration
 *
 * @property {string} schemaVersion Version of schema to use. Defaults to `v0.1`, currently does nothing.
 * @property {string} name Scenario name, used for logging. Optional.
 * @property {string} version Scenario version, used for logging. Optional.
 * @property {string} environment Scenario environment, used for logging. Optional.
 * @property {StateDeclaration[]} states List of states scenario may be at.
 * @property {ScenarioDeclaration.terminationHandler} onTermination Handler function that will be run when scenario
 *   terminates.
 * @property {ScenarioDeclaration.terminationTimeoutHandler} onTerminationTimeout Handler function that will be run if
 *   termination handler has exceeded it's time limit
 * @property {TriggerType} trigger Scenario trigger type.
 * @property {Timeouts} timeouts
 */

function ScenarioDeclaration(name, version, environment, states, onTermination, trigger, timeouts) {
    this.name = name || null;
    this.version = version || null;
    this.environment = environment || null;
    this.schemaVersion = Defaults.Schema.Version;
    this.states = states || null;
    this.onTermination = onTermination;
    this.onTerminationTimeout = null;
    this.trigger = trigger || null;
    this.timeouts = timeouts || null;
}

/**
 * This handler is called on scenario termination stage. It may be used to perform reporting tasks or to wait for
 * requests to finish.
 *
 * @callback ScenarioDeclaration.terminationHandler
 *
 * @param {object} hints User-defined hints
 * @param {CancellationToken} cancellationToken
 *
 * @return {Promise} Promise which framework will wait to resolve/reject
 */

/**
 * This handler is called when scenario termination goes off time limits.
 *
 * @callback ScenarioDeclaration.terminationTimeoutHandler
 *
 * @param {object} hints User-defined hints
 * @param {CancellationToken} cancellationToken
 * @param {TimeoutException} error
 *
 * @return {Promise} Promise which framework will wait to resolve/reject
 */

/**
 * @class StateDeclaration
 *
 * @property {string} id State id
 * @property {StateDeclaration.stateMutationHandler|undefined} transition Transition handler
 * @property {StateDeclaration.stateMutationHandler|undefined} abort Abort handler
 * @property {StateDeclaration.stateMutationHandler|undefined} onTimeout Handler that will be run on state timeout.
 * @property {StateDeclaration.stateMutationRescueHandler|undefined} onTransitionTimeout Handler that will be run on
 *   transition timeout.
 * @property {StateDeclaration.stateMutationRescueHandler|undefined} onAbortTimeout Handler that will be run on abort
 *   timeout.
 * @property {boolean|undefined} entrypoint Whether this state is entrypoint state, i.e. if scenario starts from
 *   transition to it.
 * @property {boolean|undefined} terminal Whether this state is terminal state, i.e. if scenario should be terminated
 *   after reaching thins state.
 * @property {Timeouts|undefined} timeouts Various state timeouts.
 */

/**
 * This function represents common handler interface for various state mutation calls.
 *
 * Current {ScenarioExecution} will be injected as `this` during call.
 *
 * @callback StateDeclaration.stateMutationHandler
 * @param {StateDeclaration} previousState State that was present at the moment of `.transition()` call.
 * @param {object} hints User-defined object of arbitrary hints for data transfer / conditional logic implementation.
 * @param {CancellationToken} cancellationToken A token that allows to propagate operation cancellation information
 *   backwards.
 *
 * @return {Promise.<Directive|object>} Promise that resolves with either {TransitionResult} (in case of
 * `.transition()`, `.onTransitionTimeout()` and `.onStateTimeout()` calls) or anything that will be ignored (on
 * `.abort()`, `.onAbortTimeout()` calls).
 */

/**
 * @callback StateDeclaration.stateMutationRescueHandler
 * @param {StateDeclaration} previousState State that was present at the moment of `.transition()` call.
 * @param {object} hints User-defined object of arbitrary hints for data transfer / conditional logic implementation.
 * @param {CancellationToken} cancellationToken A token that allows to propagate operation cancellation information
 *   backwards.
 * @param {TimeoutException} error Error that interrupted normal execution
 * @return {Promise.<Directive|object>}
 */

/**
 * Structure that is returned by state mutation handlers, allows to override state scenario has transitioned to, as well
 * as trigger next transition.
 *
 * @class Directive
 *
 * @property {TriggerDeclaration|string|undefined} trigger If set, triggers next transition.
 * @property {string|undefined} transitionedTo If set, forces to set current scenario state into this value.
 * @property {object} termination
 * @property {object} termination.hints
 */
function Directive(trigger, transitionedTo, termination) {
    this.trigger = trigger ? normalizeTrigger(trigger) : null;
    this.transitionedTo = transitionedTo || null;
    this.termination = termination || {hints: {}};
}

/**
 * @class ScenarioResult
 *
 * @property {boolean} successful
 * @property {TerminationStatus} status
 * @property {StateDeclaration|undefined} state
 * @property {object|undefined} error
 * @property {object|undefined} terminationError
 * @property {object|undefined} hints
 */

function ScenarioResult(successful, status, hints) {
    this.successful = successful;
    this.status = status;
    this.hints = hints || {};
    this.state = null;
    this.error = null;
    this.terminationError = null;
}

ScenarioResult.successful = function (state, hints) {
    var result = new ScenarioResult(true, TerminationStatus.Completion, hints);
    result.state = state;
    return result;
};

ScenarioResult.timeout = function (error, hints, terminationError) {
    var result = new ScenarioResult(false, TerminationStatus.ScenarioTimeout, hints);
    result.error = error;
    result.terminationError = terminationError;
    return result;
};

ScenarioResult.stateTimeout = function (state, error, hints, terminationError) {
    var result = new ScenarioResult(false, TerminationStatus.StateTimeout, hints);
    result.error = error;
    result.terminationError = terminationError;
    result.state = state;
    return result;
};

ScenarioResult.transitionFail = function (state, error, hints, terminationError) {
    var result = new ScenarioResult(false, TerminationStatus.TransitionFailure, hints);
    result.state = state;
    result.error = error;
    result.terminationError = terminationError;
    return result;
};

ScenarioResult.transitionTimeout = function (state, error, hints, terminationError) {
    var result = new ScenarioResult(false, TerminationStatus.TransitionFailure, hints);
    result.state = state;
    result.error = error;
    result.terminationError = terminationError;
    return result;
};

ScenarioResult.unexpectedException = function (error, hints, terminationError) {
    var result = new ScenarioResult(false, TerminationStatus.UnexpectedException);
    result.error = error;
    result.terminationError = terminationError;
    return result;
};

/**
 * @class
 * @param {ScenarioResult} result
 * @param {string} [message]
 */
function ScenarioExecutionException(result, message) {
    this.message = message || 'Scenario has failed with ' + result.status + ' status';
    this.result = result;
    this.stack = (new Error()).stack;
    if (result.error) {
        this.stack += '\n\nScenario error: ' + result.error.name + '\nmessage: ' + result.error.message +
            '\nstack:\n' + result.error.stack;
    }
    if (result.terminationError) {
        this.stack += '\n\nTermination error: ' + result.terminationError.name + '\nmessage: ' +
            result.terminationError.message + '\nstack:\n' + result.terminationError.stack;
    }
}

ScenarioExecutionException.prototype = Object.create(Error.prototype);
//noinspection JSUnusedGlobalSymbols
ScenarioExecutionException.prototype.constructor = ScenarioExecutionException;
//noinspection JSUnusedGlobalSymbols
ScenarioExecutionException.prototype.name = 'ScenarioExecutionException';
ScenarioExecutionException.prototype.toString = function () {
    return this.name + ': ' + this.message + '(' + this.result.status + ')';
};

/**
 * This structure declares where scenario has to transition to.
 *
 * @class TriggerDeclaration
 *
 * @property {string} id State ID
 * @property {object} hints User-defined hints that will be passed to {@link StateDeclaration.stateMutationHandler}.
 */
function TriggerDeclaration(id, hints) {
    this.id = id || null;
    this.hints = hints || {};
}

/**
 * Tells everything about scenario.
 *
 * @class ValidationResult
 *
 * @property {boolean} valid Is scenario valid
 * @property {object} violations Violations in format {path.to.property: [list of errors]}
 */

/**
 *
 * @param {function} handler
 * @param {function} defaultHandler
 * @param {function} [transformer]
 * @return {Function}
 */
function wrapHandler(handler, defaultHandler, transformer) {
    transformer = transformer || function (v) { return v; };
    return function () {
        var result = handler || defaultHandler;
        if (result instanceof Function) {
            result = result.apply(this, Array.prototype.slice.call(arguments));
        }
        return Promise.resolve(result).then(transformer);
    }
}

/**
 * Creates new state declaration with all fields set based on provided one.
 *
 * @param {StateDeclaration} state State to coerce
 *
 * @return {StateDeclaration} normalized state declaration with all fields set
 */
function normalizeState(state) {
    var result = {},
        timeouts = state.timeouts || {};

    state = state || {};
    result.id = state.id || null;
    result.transition = wrapHandler(state.transition, Defaults.State.Handler, normalizeDirective);
    result.onTransitionTimeout = wrapHandler(state.onTransitionTimeout, Defaults.State.RescueHandler, normalizeDirective);
    result.abort = wrapHandler(state.abort, Defaults.State.Handler);
    result.onAbortTimeout = wrapHandler(state.onAbortTimeout, Defaults.State.RescueHandler);
    result.onTimeout = wrapHandler(state.onTimeout, Defaults.State.RescueHandler, normalizeDirective);
    result.entrypoint = !!state.entrypoint;
    result.terminal = !!state.terminal;
    result.timeouts = utilities.objects.copy(Defaults.Timeouts);
    Object.keys(Defaults.Timeouts).forEach(function (key) {
        if (key in timeouts) {
            result.timeouts[key] = timeouts[key];
        }
    });
    //noinspection JSValidateTypes
    return result;
}

/**
 * Normalizes full scenario.
 *
 * @param {ScenarioDeclaration} scenario Scenario to normalize.
 *
 * @return {ScenarioDeclaration} Normalized scenario.
 */
function normalizeScenario(scenario) {
    var terminationHandler = scenario.onTermination || Defaults.Scenario.TerminationHandler,
        terminationTimeoutHandler = scenario.onTerminationTimeout || Defaults.Scenario.TerminationTimeoutHandler,
        timeouts = scenario.timeouts || utilities.objects.copy(Defaults.Timeouts),
        states = (scenario.states || []);

    Object.keys(Defaults.Timeouts).forEach(function (key) {
        if (typeof timeouts[key] !== 'undefined') {
            timeouts[key] = Defaults.Timeouts[key];
        }
    });

    if (!(terminationHandler instanceof Function)) {
        if (!(terminationHandler.then instanceof Function)) {
            terminationHandler = Promise.resolve(terminationHandler);
        }
        terminationHandler = (function (v) {
            return function () {
                return v;
            };
        })(terminationHandler);
    }

    if (!terminationTimeoutHandler instanceof Function) {
        if (!(terminationTimeoutHandler.then instanceof Function)) {
            terminationTimeoutHandler = Promise.resolve(terminationTimeoutHandler);
        }
        terminationTimeoutHandler = (function (v) {
            return function () {
                return v;
            };
        })(terminationTimeoutHandler);
    }
    return {
        schemaVersion: scenario.schemaVersion || Defaults.Schema.Version,
        id: scenario.id,
        version: scenario.version,
        environment: scenario.environment,
        settings: scenario.settings,
        states: states.map(function (state) {
            state.timeouts = state.timeouts || {};
            Object.keys(timeouts).forEach(function (key) {
                if (!(key in state.timeouts)) {
                    state.timeouts[key] = timeouts[key];
                }
            });
            return normalizeState(state);
        }),
        onTermination: terminationHandler,
        onTerminationTimeout: terminationTimeoutHandler,
        trigger: scenario.trigger,
        timeouts: timeouts
    }
}

/**
 * Coerces trigger declaration to full form. Allowed forms:
 *
 * - `'id'`
 * - `{id: 'id', hints: {object: properties}}`
 *
 * @param {TriggerDeclaration|object} trigger
 * @return {TriggerDeclaration}
 */
function normalizeTrigger(trigger) {
    if (!trigger) {
        return new TriggerDeclaration(null);
    }
    if (utilities.objects.isString(trigger)) {
        return new TriggerDeclaration(trigger);
    }
    return new TriggerDeclaration(trigger.id, trigger.hints);
}

/**
 * @param {Directive|object} directive
 *
 * @return {Directive}
 */
function normalizeDirective(directive) {
    if (!directive) {
        return new Directive(null, null, {hints: {}});
    }
    return new Directive(normalizeTrigger(directive.trigger), directive.transitionedTo, directive.termination);
}

/**
 * @param {ScenarioDeclaration} scenario
 * @param {boolean} normalized Is scenario already normalized?
 * @return {ValidationResult}
 */
function validateScenario(scenario, normalized) {
    var violations = {
            states: [],
            trigger: []
        };
    if (!normalized) {
        scenario = normalizeScenario(scenario);
    }
    if (!scenario.trigger || scenario.trigger.length === 0) {
        violations.trigger = ['Missing trigger'];
    } else {
        var knownTrigger = Object.keys(TriggerType).some(function (key) {
            return key.toLowerCase() === scenario.trigger.toLowerCase();
        });
        if (!knownTrigger) {
            violations.trigger = ['Unknown trigger `' + scenario.trigger + '`'];
        }
    }
    var states = {},
        terminalStates = [],
        entrypointStates = [],
        overlappingStates = [];
    scenario.states.forEach(function (state) {
        if (!state.id || state.id.length === 0) {
            violations.states.push('Found state without id');
            return;
        }
        var id = state.id;
        if (state.entrypoint) {
            entrypointStates.push(id);
        }
        if (state.terminal) {
            terminalStates.push(id);
        }
        if (states[id]) {
            overlappingStates.push(id);
        }
        states[id] = state;
    });
    if (terminalStates.length === 0) {
        violations.states.push('No terminal states found');
    }
    if (entrypointStates.length === 0) {
        violations.states.push('Entrypoint state not found');
    }
    if (entrypointStates.length > 1) {
        violations.states.push('Several entrypoints found: ' + entrypointStates.join(', '));
    }
    overlappingStates.forEach(function (state) {
        violations['states.' + state] = ['state defined several times'];
    });
    var cleanedViolations = {};
    Object.keys(violations).forEach(function (key) {
        if (violations[key].length > 0) {
            cleanedViolations[key] = violations[key];
        }
    });
    return {
        valid: Object.keys(cleanedViolations).length === 0,
        violations: cleanedViolations
    };
}

exports = module.exports = {
    normalizeScenario: normalizeScenario,
    normalizeState: normalizeState,
    normalizeTrigger: normalizeTrigger,
    normalizeDirective: normalizeDirective,
    validateScenario: validateScenario,
    Directive: Directive,
    TriggerDeclaration: TriggerDeclaration,
    ScenarioResult: ScenarioResult,
    ScenarioExecutionException: ScenarioExecutionException,
    TriggerType: utilities.objects.copy(TriggerType, true),
    CompletionStatus: TerminationStatus,
    Defaults: utilities.objects.copy(Defaults, true)
};

