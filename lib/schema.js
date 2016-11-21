var utilities = require('./utility/common'),
    /**
     * @enum
     * @readonly
     */
    TriggerType = {
        Call: 'Call',
        Http: 'Http'
    },
    DEFAULTS = {
        SCHEMA: {
            VERSION: 'v0.1'
        },
        STATE: {
            TIMEOUTS: {
                transition: 45 * 1000,
                abort: 5 * 1000,
                self: null,
                onTransitionTimeout: 15 * 1000,
                onAbortTimeout: 15 * 1000,
                onStateTimeout: 15 * 1000
            }
        },
        SCENARIO: {
            TIMEOUTS: {
                onTermination: 15 * 1000,
                onTerminationTimeout: 15 * 1000,
                transition: 45 * 1000,
                abort: 10 * 1000,
                state: null
            },
            TERMINATION_HANDLER: function () {
                return Promise.resolve({});
            },
            TERMINATION_TIMEOUT_HANDLER: function (hints, token, error) {
                return Promise.reject(error);
            }
        }
    };

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
 * @property {object} timeouts Specifies various timeouts. State timeouts are applied as default ones, i.e. timeout
 *   specified in state declaration timeout will override timeout specified here.
 * @property {number|undefined} timeouts.self How long scenario is allowed to run, defaults to `null` (no timeout at all)
 * @property {number} timeouts.onTermination How long termination callback is allowed to run. If running time exceeds
 *   specified, scenario terminates without waiting for callback to finish. As all other timeouts, this may be
 *   left undefined/null/less than zero to disable timeout.
 * @property {number} timeouts.onTerminationTimeout How long `.onTerminationTimeout()` handler will be waited for.
 * @property {number} timeouts.transition How long state transition may take before cancellation. If time is exceeded,
 *   onTransitionTimeout is called.
 * @property {number} timeouts.abort How long state abort process may take.
 * @property {number} timeouts.state How long scenario may stay in state. Defaults to `null` (no timeout at all).
 * @property {number} timeouts.onTransitionTimeout How long onTransitionTimeout may take.
 * @property {number} timeouts.onAbortTimeout How long onAbortTimeout may take.
 * @property {number} timeouts.onStateTimeout How long onStateTimeout may take.
 * @property {settings}
 */

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
 * This class provides a way to notify running code about external interrupt (i.e. abort in this case). As soon as task
 * is interrupted, `.isCancelled()` will return false, so interrupt-aware code should check it's result to know if task
 * has been cancelled
 *
 * @class CancellationToken
 */

/**
 * Whether execution has been cancelled.
 *
 * @function CancellationToken.isCancelled
 *
 * @return {boolean}
 */

/**
 * @class StateId
 *
 * @property {string} id State id.
 * @property {string} stage State stage.
 */

/**
 * @class StateDeclaration
 *
 * @property {string} id State id
 * @property {string|undefined} stage Stage state belongs to
 * @property {StateDeclaration.stateMutationHandler|undefined} transition Transition handler
 * @property {StateDeclaration.stateMutationHandler|undefined} abort Abort handler
 * @property {StateDeclaration.stateMutationHandler|undefined} onTimeout Handler that will be run on state timeout.
 * @property {StateDeclaration.stateMutationHandler|undefined} onTransitionTimeout Handler that will be run on
 *   transition timeout.
 * @property {StateDeclaration.stateMutationHandler|undefined} onAbortTimeout Handler that will be run on abort timeout.
 * @property {boolean|undefined} entrypoint Whether this state is entrypoint state, i.e. if scenario starts from
 *   transition to it.
 * @property {boolean|undefined} terminal Whether this state is terminal state, i.e. if scenario should be terminated
 *   after reaching thins state.
 * @property {object|undefined} timeouts Various state timeouts.
 * @property {number|undefined|null} timeouts.transition How long transition is allowed to run before cancellation.
 * @property {number|undefined|null} timeouts.abort How long abort is allowed to run before cancellation.
 * @property {number|undefined|null} timeouts.self How long scenario may stay in this state. Defaults to `null`
 *   (unlimited).
 * @property {number|undefined|null} timeouts.onTransitionTimeout How long may transition timeout handler run.
 * @property {number|undefined|null} timeouts.onAbortTimeout How long may abort timeout handler run.
 * @property {number|undefined|null} timeouts.onTimeout How long may state timeout handler run.
 */

/**
 * This function represents common handler interface for various state mutation calls.
 *
 * Current {ScenarioExecution} will be injected as `this` during call.
 *
 * @callback StateDeclaration.stateMutationHandler
 * @param {StateId} previousState State that was present at the moment of `.transition()` call.
 * @param {object} hints User-defined object of arbitrary hints for data transfer / conditional logic implementation.
 * @param {CancellationToken} cancellationToken A token that allows to propagate operation cancellation information
 *   backwards.
 *
 * @return {Promise.<TransitionResult|object>} Promise that resolves with either {TransitionResult} (in case of
 * `.transition()`, `.onTransitionTimeout()` and `.onStateTimeout()` calls) or anything that will be ignored (on
 * `.abort()`, `.onAbortTimeout()` calls).
 */

/**
 * Structure that is returned by state mutation handlers, allows to override state scenario has transitioned to, as well
 * as trigger next transition.
 *
 * @class TransitionResult
 *
 * @property {TriggerDeclaration|string|undefined} trigger If set, triggers next transition.
 * @property {StateId|string|undefined} transitionedTo If set, forces to set current scenario state into this value.
 */

/**
 * This structure declares where scenario has to transition to.
 *
 * @class TriggerDeclaration
 *
 * @property {string} id State ID
 * @property {string} stage State stage
 * @property {object} hints User-defined hints that will be passed to {@link StateDeclaration.stateMutationHandler}.
 */

/**
 * Tells everything about scenario.
 *
 * @class ValidationResult
 *
 * @property {boolean} valid Is scenario valid
 * @property {object} violations Violations in format {path.to.property: [list of errors]}
 */

/**
 * Creates new state declaration with all fields set based on provided one.
 *
 * @param {StateDeclaration} state State to coerce
 * @param {object} [defaultTimeouts] Timeout defaults as set in scenario
 *
 * @return {StateDeclaration} normalized state declaration with all fields set
 */

function normalizeState(state, defaultTimeouts) {
    var result = {},
        timeouts = state.timeouts || {},
        id;

    state = state || {};
    defaultTimeouts = defaultTimeouts || {};
    id = normalizeStateId({id: state.id, stage: state.stage});
    result.id = id.id;
    result.stage = id.stage;
    result.transition = wrapHandler(state.transition, this);
    result.abort = wrapHandler(state.abort, this);
    result.onTimeout = wrapHandler(state.onTimeout, this);
    //noinspection PointlessBooleanExpressionJS
    result.entrypoint = !!state.entrypoint;
    //noinspection PointlessBooleanExpressionJS
    result.terminal = !!state.terminal;
    result.timeouts = utilities.object.copy(DEFAULTS.STATE.TIMEOUTS);
    Object.keys(DEFAULTS.STATE.TIMEOUTS).forEach(function (key) {
        if (typeof timeouts[key] !== 'undefined') {
            result.timeouts[key] = timeouts[key];
        } else if (typeof defaultTimeouts[key] !== 'undefined') {
            result.timeouts[key] = defaultTimeouts[key];
        }
    });
    return result;
}

function wrapHandler(transition) {
    return function (previousState, hints, cancellationToken) {
        var result = transition || {};
        if (transition instanceof Function) {
            result = transition.call(this, previousState, hints, cancellationToken);
        }
        return Promise.resolve(result);
    }
}

/**
 * Normalizes full scenario.
 *
 * @param {ScenarioDeclaration} scenario Scenario to normalize.
 *
 * @return {ScenarioDeclaration} Normalized scenario.
 */
function normalizeScenario(scenario) {
    var terminationHandler = scenario.onTermination || DEFAULTS.SCENARIO.TERMINATION_HANDLER,
        terminationTimeoutHandler = scenario.onTerminationTimeout || DEFAULTS.SCENARIO.TERMINATION_TIMEOUT_HANDLER,
        timeouts = DEFAULTS.SCENARIO.TIMEOUTS,
        scenarioTimeouts = scenario.timeouts || {},
        states = (scenario.states || []),
        stateTimeouts = {};

    Object.keys(scenarioTimeouts).forEach(function (key) {
        if (typeof scenarioTimeouts[key] !== 'undefined') {
            timeouts[key] = scenarioTimeouts[key];
        }
    });
    stateTimeouts.self = timeouts.state;
    stateTimeouts.abort = timeouts.abort;
    stateTimeouts.transition = timeouts.transition;
    stateTimeouts.onStateTimeout = timeouts.onStateTimeout;
    stateTimeouts.onAbortTimeout = timeouts.onAbortTimeout;
    stateTimeouts.onTransitionTimeout = timeouts.onTransitionTimeout;

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
        schemaVersion: scenario.schemaVersion || DEFAULTS.SCHEMA.VERSION,
        id: scenario.id,
        version: scenario.version,
        environment: scenario.environment,
        settings: scenario.settings,
        states: states.map(function (state) {
            return normalizeState(state, stateTimeouts);
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
 * - `'[stage:]id`
 * - `{id: 'id'}`
 *
 * @param {TriggerDeclaration} trigger
 * @param {string} defaultStage
 * @return {TriggerDeclaration}
 */
function normalizeTrigger(trigger, defaultStage) {
    var id = normalizeStateId(trigger, defaultStage);
    return {
        id: id.id,
        stage: id.stage,
        hints: trigger.hints || {}
    };
}

/**
 * Coerces state id from `{id: 'x'}` and `'stage:id'` forms to full.
 *
 * @param {StateId|string} id
 * @param {string} defaultStage
 *
 * @return {StateId}
 */
function normalizeStateId(id, defaultStage) {
    var buffer = id;
    if (!id) {
        throw {
            name: 'IllegalArgumentException',
            message: '`' + id + '` can\'t be treated as valid state id',
            stack: (new Error()).stack
        }
    }
    if (typeof id === 'object' && (!id.stage || id.stage.length === 0)) {
        id = id.id;
    }
    if (typeof id === 'string') {
        var chunks = id.split(':', 2);
        buffer = {
            id: chunks.length > 1 ? chunks[1] : chunks[0],
            stage: chunks.length > 1 ? chunks[0] : defaultStage
        };
    }
    return {
        id: buffer.id && buffer.id.length > 0 ? buffer.id : null,
        stage: buffer.stage && buffer.stage.length > 0 ? buffer.stage : 'default'
    };
}

/**
 * @param {TransitionResult} result
 * @param {string} [defaultStage] May be used as stage in case it is omitted
 *
 * @return {TransitionResult}
 */
function normalizeTransitionResult(result, defaultStage) {
    result = result || {};
    return {
        trigger: result.trigger ? normalizeTrigger(result.trigger, defaultStage) : null,
        transitionedTo: result.transitionedTo ? normalizeStateId(result.transitionedTo, defaultStage) : null
    };
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
        var id = state.stage + '.' + state.id;
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
    normalizeStateId: normalizeStateId,
    normalizeTrigger: normalizeTrigger,
    normalizeTransitionResult: normalizeTransitionResult,
    validateScenario: validateScenario,
    TriggerType: utilities.object.copy(TriggerType, true),
    DEFAULTS: utilities.object.copy(DEFAULTS, true)
};

