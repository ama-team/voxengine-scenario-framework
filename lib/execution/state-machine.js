var concurrent = require('../utility/concurrent'),
    CompletablePromise = concurrent.CompletablePromise,
    timeout = concurrent.safeTimeout,
    schema = require('../schema/definitions'),
    TerminationCause = schema.TerminationCause,
    MachineTerminationResult = schema.MachineTerminationResult,
    TransitionResult = schema.TransitionResult,
    transitions = require('./transition'),
    Transition = transitions.Transition,
    TransitionState = transitions.TransitionState;

/**
 * @enum
 * @readonly
 */
var MachineStatus = {
    Idle: 'Idle',
    Transitioning: 'Transitioning',
    Terminated: 'Terminated',
    Terminating: 'Terminating'
};

/**
 * This class executes user-defined transitions and is not a finite state machine. It's just a state machine.
 *
 * It operates under following circumstances:
 *
 * - Only one active transition may be present. If second transition is launched during first one, the first one is
 * aborted and put up into 'waiting' queue so termination sequence may wait for it to finish. Aborted transitions don't
 * affect outcome.
 * - Once state with terminal flag set is reached, machine successfully terminates
 * - If transition fails or times out, machine terminates with an exception
 * - If state timeout is reached, and rescue handler doesn't save the situation, machine terminates with an exception
 *
 * @class
 *
 * @param {State[]} states
 * @param {ExecutionRuntime} runtime
 * @param {Slf4jAlikeLogger} logger
 * @constructor
 */
function StateMachine(states, runtime, logger) {

    var status = MachineStatus.Idle,
        scenarioState,
        scenarioStateTimeout,
        active,
        history = [],
        completion = new CompletablePromise(),
        termination = completion.then(terminate, terminate),
        transitions = [],
        entrypoint = states.reduce(function (c, s) { return s.entrypoint ? s: c; }, null);

    runtime.transitionTo = transitionTo;

    // region state management

    /**
     * Finds state with given id
     *
     * @param {string} id
     *
     * @return {State|null}
     */
    function getState(id) {
        return states.reduce(function (v, s) { return v || s.id !== id ? v : s }, null);
    }

    /**
     * Finds state with given id or throws an error
     *
     * @param id
     *
     * @return {State}
     */
    function requireState(id) {
        var s = getState(id);
        if (!s) { throw new Error('State ' + id + ' is not registered'); }
        return s;
    }

    /**
     * Sets current state to one passed as argument
     *
     * @param {string} id
     */
    function setState(id) {
        var s = scenarioState = requireState(id);
        logger.info('State machine has reached state {}', id);
        if (scenarioStateTimeout) {
            logger.debug('Clearing previous state timeout');
            scenarioStateTimeout.resolve();
        }
        if (s.timeouts.state > 0) {
            logger.debug('Setting timeout for state {} ({} ms)', s.id, s.timeouts.state);
            scenarioStateTimeout = new CompletablePromise();
            timeout(scenarioStateTimeout, s.timeouts.state, function (res, rej, e) {
                logger.debug('State {} has reached it\'s timeout of {} ms, terminating', s.id, s.timeouts.state);
                if (status === MachineStatus.Transitioning) {
                    abortRunningTransition();
                }
                completion.resolve(new MachineTerminationResult(TerminationCause.StateTimeout, e, scenarioState));
                res();
            });
        }
        history.push(s);
    }

    // endregion

    // region transition registry

    function registerTransition(transition) {
        transitions.push(transition);
        return transition;
    }

    function deregisterTransition(transition) {
        transitions = transitions.filter(function (t) { return t !== transition });
        return transition;
    }

    // endregion

    // region transaction processing

    /**
     * Performs transition to state with selected id.
     *
     * @param {string} id ID of state to transition to.
     * @param {object} hints User-defined hints for transition.
     * @return {Promise}
     */
    function transitionTo(id, hints) {
        if (status === MachineStatus.Terminating || status === MachineStatus.Terminated) {
            var e = new Error('.transitionTo called on terminating/terminated state machine');
            return Promise.resolve(new TransitionResult(TerminationCause.InvalidUsage, e));
        }
        try {
            hints = hints || {};
            logger.debug('Running transition to state {} with hints {}', id, hints);
            if (status === MachineStatus.Transitioning) {
                logger.debug('Found already active transition, aborting it');
                abortRunningTransition();
            }
            var transition = active = new Transition(scenarioState, requireState(id), hints, runtime, logger);
            registerTransition(transition);
            status = MachineStatus.Transitioning;
            return active.run()
                .then(function (v) {
                    return handleResolve(transition, v);
                }, function (e) {
                    return handleResolve(transition, new TransitionResult(TerminationCause.FrameworkFailure, null, e));
                });
        } catch (e) {
            completion.resolve(new MachineTerminationResult(TerminationCause.FrameworkFailure, e));
            return termination;
        }
    }

    /**
     * Processes transition resolution result.
     *
     * @param {Transition} transition
     * @param {TransitionResult} result
     *
     * @return {Promise.<TransitionResult>}
     */
    function handleResolve(transition, result) {
        deregisterTransition(transition);
        if (transition === active) {
            return handleActiveTransitionResolve(transition, result);
        }
        if (!result.success && result.cause !== TerminationCause.Abortion) {
            logger.error('Aside transition {} has finished because of {} with error: ', transition.toString(),
                result.cause, result.error)
        }
        return result;
    }

    function handleActiveTransitionResolve(transition, result) {
        status = MachineStatus.Idle;
        if (!result.success) {
            completion.resolve(new MachineTerminationResult(result.cause, result.error, transition.target));
            return result;
        }
        var directive = result.directive || {};
        if (!directive) {
            logger.warn('Directive is not defined');
            directive = {};
        }
        var target = directive.transitionedTo ? directive.transitionedTo : transition.target.id;
        logger.debug('{} has reached state `{}`', transition.toString(), target);
        setState(target);
        if (scenarioState.terminal) {
            logger.info('Reached state` {}` is terminal, halting', scenarioState.id);
            completion.resolve(new MachineTerminationResult(TerminationCause.Completion, null, scenarioState));
            return result;
        }
        if (directive.trigger && directive.trigger.id) {
            logger.info('{} triggers next transition to state `{}`', transition.toString(), directive.trigger.id);
            transitionTo(directive.trigger.id, directive.trigger.hints);
        }
        return result;
    }

    // endregion

    /**
     * Aborts currently running transition.
     *
     * @return {Promise} promise that will resolve/reject once transition has completely finished.
     */
    function abortRunningTransition() {
        if (status !== MachineStatus.Transitioning) {
            logger.warn('abortRunningTransition() called with no running transition');
            return Promise.resolve({});
        }
        logger.debug('Aborting active transition {}', active.toString());
        status = MachineStatus.Idle;
        return active.abort();
    }

    /**
     * Runs termination chores
     *
     * @return {Promise}
     */
    function terminate() {
        logger.debug('Terminating state machine');
        status = MachineStatus.Terminating;
        if (active && active.getState() === TransitionState.Running) {
            active.abort();
            active = null;
        }
        logger.debug('Waiting for {} transitions to finish', transitions.length);
        return Promise.all(transitions).then(function () {
            logger.debug('State machine terminated');
            status = MachineStatus.Terminated;
            return completion;
        });
    }

    function run(hints) {
        if (status === MachineStatus.Terminating || status === MachineStatus.Terminated) {
            var e = new Error('.transitionTo called on terminating/terminated state machine');
            return Promise.resolve(new MachineTerminationResult(TerminationCause.InvalidUsage, e));
        }
        transitionTo(entrypoint.id, hints || {});
        return termination;
    }

    this.run = run;

    this.transitionTo = transitionTo;
    //noinspection JSUnusedGlobalSymbols
    this.abortRunningTransition = abortRunningTransition;
    //noinspection JSUnusedGlobalSymbols
    this.getRunningTransition = function () { return active; };
    //noinspection JSUnusedGlobalSymbols
    this.getCompletion = function () { return termination; };
    //noinspection JSUnusedGlobalSymbols
    this.getHistory = function () { return history; };

    this.getState = function () { return status; };

    this.abort = function () {
        terminate();
    }
}

exports = module.exports = {
    StateMachine: StateMachine,
    MachineStatus: MachineStatus
};