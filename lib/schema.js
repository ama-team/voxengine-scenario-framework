var utilities = require('./utility/common');

/**
 * @class ScenarioDeclaration
 * @property {string} name
 * @property {string} version
 * @property {string} environment
 * @property {StateDeclaration[]} states
 * @property {ScenarioDeclaration.terminationHandler} onTermination
 * @property {TriggerType} trigger
 * @property {object} timeouts Specifies various timeouts. State timeouts are applied as default ones, i.e. state
 *   declaration timeout will override timeout specified here.
 * @property {number} timeouts.onTermination
 * @property {number} timeouts.transition
 * @property {number} timeouts.abort How long state
 * @property {number} timeouts.state How long scenario may stay in state. Defaults to `null` (no timeout at all).
 */

/**
 * This handler is called on scenario termination stage. It may be used to perform reporting tasks or to wait for
 * requests to finish.
 *
 * @callback ScenarioDeclaration.terminationHandler
 *
 * @param {object} hints User-defined hints
 *
 * @return {Promise} Promise which framework will wait to resolve/reject, but result will be completely ignored
 */

/**
 * This class provides a way to notify running code about external interrupt (i.e. abort in this case). As soon as task
 * is interrupted, `.isCancelled()` will return false, so interrupt-aware code should check it's result to know if task
 * has been cancelled
 *
 * @class CancellationToken
 */

/**
 * @function CancellationToken.isCancelled
 *
 * @return {boolean}
 */

/**
 * @class StateId
 *
 * @property {string} id
 * @property {string} stage
 */

/**
 * @class StateDeclaration
 *
 * @property {string} id
 * @property {string|undefined} stage
 * @property {StateDeclaration.transitionHandler} transition
 * @property {StateDeclaration.abortHandler|undefined} abort
 * @property {StateDeclaration.timeoutHandler|undefined} onTimeout
 * @property {boolean|undefined} entrypoint
 * @property {boolean|undefined} terminal
 * @property {object|undefined} timeouts
 * @property {number|undefined|null} timeouts.transition
 * @property {number|undefined|null} timeouts.abort
 * @property {number|undefined|null} timeouts.self
 */

/**
 *
 *
 * @callback StateDeclaration.transitionHandler
 * @param {StateId} previousState
 * @param {object} hints
 * @param {CancellationToken} cancellationToken
 *
 * @return {Promise}
 */

/**
 *
 *
 * @callback StateDeclaration.abortHandler
 * @param {StateId} previousState
 * @param {object} hints
 *
 * @return {Promise}
 */

/**
 *
 *
 * @callback StateDeclaration.timeoutHandler
 * @param {StateId} previousState
 * @param {object} hints
 *
 * @return {Promise}
 */

/**
 * This structure declares where scenario has to transition to.
 *
 * @class TriggerDeclaration
 *
 * @property {string} id State ID
 * @property {string} stage State stage
 * @property {object} hints User-defined hints that will be passed to {@link StateDeclaration.transitionHandler}.
 */

/**
 *
 * @class ValidationResult
 *
 * @property {boolean} valid Is scenario valid
 * @property {object} violations Violations in format {path.to.property: [list of errors]}
 */

/**
 * @enum
 * @readonly
 */
var TriggerType = {
    Call: 'Call',
    Http: 'Http'
};

var DEFAULTS = {
    STATE: {
        TIMEOUTS: {
            transition: 45 * 1000,
            abort: 5 * 1000,
            self: null
        }
    },
    SCENARIO: {
        TIMEOUTS: {
            onTermination: 15 * 1000,
            transition: 45 * 1000,
            abort: 10 * 1000,
            state: null
        }
    }
};

/**
 * Creates new state declaration with all fields set based on provided one.
 *
 * @param {StateDeclaration} state State to coerce
 * @param {object} defaultTimeouts Timeout defaults as set in scenario
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

function wrapHandler(transition, self) {
    return function (previousState, hints, cancellationToken) {
        var result = transition || {};
        if (transition instanceof Function) {
            result = transition.call(self, previousState, hints, cancellationToken);
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
    var terminationHandler = null,
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

    return {
        id: scenario.id,
        version: scenario.version,
        environment: scenario.environment,
        settings: scenario.settings,
        states: states.map(function (state) {
            return normalizeState(state, stateTimeouts);
        }),
        onTermination: terminationHandler,
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
 * @return {TriggerDeclaration}
 */
function normalizeTrigger(trigger) {
    var id = normalizeStateId(trigger);
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
 * @return {StateId}
 */
function normalizeStateId(id) {
    var buffer = id;
    if (!id) {
        throw {
            name: 'IllegalArgumentException',
            message: '`' + id + '` can\'t be treated as valid state id'
        }
    }
    if (typeof id === 'object' && (!id.stage || id.stage.length === 0)) {
        id = id.id;
    }
    if (typeof id === 'string') {
        var chunks = id.split(':', 2);
        buffer = {
            id: chunks.length > 1 ? chunks[1] : chunks[0],
            stage: chunks.length > 1 ? chunks[0] : null
        };
    }
    return {
        id: buffer.id && buffer.id.length > 0 ? buffer.id : null,
        stage: buffer.stage && buffer.stage.length > 0 ? buffer.stage : 'default'
    };
}

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
    validateScenario: validateScenario,
    TriggerType: TriggerType
};

