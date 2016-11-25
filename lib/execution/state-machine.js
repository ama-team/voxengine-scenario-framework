var concurrent = require('../utility/concurrent'),
    CompletablePromise = concurrent.CompletablePromise,
    timeout = concurrent.safeTimeout,
    transitions = require('./transition'),
    Transition = transitions.Transition;
/**
 * @enum
 * @readonly
 */
var MachineState = {
    Idle: 'Idle',
    Transition: 'Transition',
    Terminating: 'Terminating',
    Terminated: 'Terminated'
};
/**
 * @enum
 * @readonly
 */
var MachineTerminationCause = {
    Success: 'Success',
    TransitionFail: 'TransitionFail',
    TransitionTimeout: 'TransitionTimeout',
    StateTimeout: 'StateTimeout',
    UnexpectedException: 'UnexpectedException'
};

/**
 * @class
 *
 * @param {MachineTerminationCause} cause
 * @param {Error|undefined|null} [error]
 * @param {string|undefined|null} [message]
 */
function MachineTerminationException(cause, message, error) {
    //noinspection JSUnusedGlobalSymbols
    this.cause = cause;
    this.message = message || 'State machine has terminated abnormal due to ' + cause;
    this.stack = (new Error()).stack + (error ? '\n\n' + error.name + ' ' + error.stack : '');
}
MachineTerminationException.prototype = Object.create(Error.prototype);
MachineTerminationException.prototype.name = 'MachineTerminationException';
MachineTerminationException.prototype.constructor = MachineTerminationException;

/**
 * This class executes user-defined transitions and is not a finite state machine. It's just a state machine.
 *
 * @class
 *
 * @param {StateDeclaration[]} states
 * @param {ExecutionRuntime} runtime
 * @param {Slf4jAlikeLogger} logger
 * @constructor
 */
function StateMachine(states, runtime, logger) {

    var state = MachineState.Idle,
        scenarioState,
        scenarioStateTimeout,
        running,
        history = [],
        completion = new CompletablePromise(),
        transitions = [];

    /**
     * Finds state with given id
     *
     * @param {string} id
     *
     * @return {StateDeclaration|null}
     */
    function getState(id) {
        return states.reduce(function (v, s) { return v || s.id !== id ? v : s }, null);
    }

    /**
     * Finds state with given id or throws an error
     *
     * @param id
     *
     * @return {StateDeclaration}
     */
    function requireState(id) {
        var s = getState(id);
        if (!s) { throw new Error('State ' + id + ' is not registered'); }
        return s;
    }

    function setState(id) {
        var s = scenarioState = requireState(id);
        if (scenarioStateTimeout) { scenarioStateTimeout.resolve(); }
        scenarioStateTimeout = new CompletablePromise();
        timeout(scenarioStateTimeout, s.timeouts.state, function (res, rej, e) {
            completion.reject(new MachineTerminationException(MachineTerminationCause.StateTimeout, e));
            res();
        });
    }

    function transitionTo(id, hints) {
        if (state === MachineState.Transition) { abortRunningTransition(); }
        if (state !== MachineState.Idle) { throw new Error('Invalid machine state: ' + state); }
        var transition = running = new Transition(scenarioState, requireState(id), hints, runtime, logger);
        transitions.push(transition);
        state = MachineState.Transition;
        return running.run()
            .then(function (v) {
                return handleResolve(transition, v);
            }, function (e) {
                return handleReject(transition, e);
            });
    }

    function abortRunningTransition() {
        if (state !== MachineState.Transition) {
            logger.warn('abortRunningTransition() called with no running transition');
            return Promise.resolve({});
        }
        state = MachineState.Idle;
        return running.abort();
    }

    function handleResolve(transition, v) {
        // todo
        throw new Error('Not implemented');
    }

    function handleReject(transition, e) {
        // todo
        throw new Error('Not implemented');
    }

    function handleFinished(transition) {
        transitions = transitions.filter(function (t) { return t !== transition; });
        if (running === transition) { running = null; }
    }

    this.transitionTo = transitionTo;
    //noinspection JSUnusedGlobalSymbols
    this.abortRunningTransition = abortRunningTransition;
    //noinspection JSUnusedGlobalSymbols
    this.getRunningTransition = function () { return running; };
    //noinspection JSUnusedGlobalSymbols
    this.getCompletion = function () { return completion; };
    //noinspection JSUnusedGlobalSymbols
    this.getHistory = function () { return history; };
}

exports = module.exports = {
    StateMachine: StateMachine,
    MachineState: MachineState,
    MachineTerminationCause: MachineTerminationCause,
    MachineTerminationException: MachineTerminationException
};