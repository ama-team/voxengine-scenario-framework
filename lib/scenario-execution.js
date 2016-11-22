var utilities = require('./utility/common'),
    concurrent = require('./utility/concurrent'),
    CancellationToken = concurrent.CancellationToken,
    CompletablePromise = concurrent.CompletablePromise,
    schema = require('./schema'),
    sdk = require('@ama-team/voxengine-sdk'),
    LogLevel = sdk.loggers.LogLevel;

/**
 *
 * @param promise
 * @param milliseconds
 * @param [onTimeout]
 */
function timeout(promise, milliseconds, onTimeout) {
    if (!milliseconds || milliseconds < 0) {
        return promise;
    }
    return concurrent.timeout(promise, milliseconds, onTimeout);
}

var ExecutionState = {
    Idle: 'Idle',
    Transition: 'Transition',
    Terminating: 'Terminating',
    Terminated: 'Terminated'
};

/**
 * @class ScenarioExecutionContext
 * @property {object} settings
 * @property {function|undefined} settings.argumentDeserializer Function that will be used to deserialize customData
 *   bundled with HTTP request / incoming call into `this.arguments`. Not set by default.
 * @property {object} container DI container with components required by scenario. Will be merged with default one
 *   created by execution and will be accessible through `this.container` in handlers.
 */

/**
 * @class Transition
 *
 * @property {Promise} promise
 * @property {StateDeclaration} origin
 * @property {StateDeclaration} target
 * @property {object} hints
 * @property {CancellationToken} cancellation
 */

/**
 * @class
 * 
 * @param {ScenarioDeclaration} scenario Scenario itself
 * @param {ScenarioExecutionContext} [context] Execution context.
 *
 * @property {ScenarioDeclaration} scenario
 * @property {object} arguments
 * @property {object} data
 * @property {object} container
 */
function ScenarioExecution(scenario, context) {

    context = context || {};
    scenario = schema.normalizeScenario(scenario);
    var validationResult = schema.validateScenario(scenario, true);
    if (!validationResult.valid) {
        throw {
            name: 'InvalidScenarioException',
            message: 'Passed scenario is invalid',
            validationResult: validationResult
        }
    }

    //noinspection JSUnusedLocalSymbols
    var completionHook = new CompletablePromise(),
        states = scenario.states.map(schema.normalizeState),
        entrypoint = scenario.states.reduce(function (found, candidate) {
            return found ? found : (candidate.entrypoint ? candidate : null);
        }),
        timeouts = {
            onTermination: scenario.timeouts.onTermination,
            onTerminationTimeout: scenario.timeouts.onTerminationTimeout
        },
        defaultContainer = {
            logger: { log: function () {} }
        },
        container = utilities.object.overwrite(defaultContainer, context.container || {}, false),
        activeProcesses = [],
        state = {
            execution: ExecutionState.Idle,
            scenario: null,
            transition: null,
            timeout: null
        },
        history = [],
        /**
         * @function executeHandler
         *
         * @param {function} handler
         * @param {...object} parameters
         */
        executeHandler = (function (self) {
            return function (handler) {
                return handler.apply(self, Array.prototype.slice.call(arguments, 1));
            }
        })(this),
        scenarioTimeout = timeout(new Promise(function () {}), scenario.timeouts.scenario, function (resolve, reject, e) {
            terminate(Promise.reject(e), {});
            reject(e);
        });

    this.scenario = scenario;
    this.arguments = {};
    this.container = container;
    this.data = {};

    function log(level, message, parameters) {
        container.logger.log.apply(container.logger, [level, message].concat(parameters));
    }

    function debug(message) {
        log(LogLevel.DEBUG, message, Array.prototype.slice.call(arguments, 1));
    }

    function info(message) {
        log(LogLevel.INFO, message, Array.prototype.slice.call(arguments, 1));
    }

    function warn(message) {
        log(LogLevel.WARN, message, Array.prototype.slice.call(arguments, 1));
    }

    function error(message) {
        log(LogLevel.ERROR, message, Array.prototype.slice.call(arguments, 1));
    }

    function getState(stage, id) {
        for (var i = 0; i < states.length; i++) {
            var state = states[i];
            if (state.stage === stage && state.id === id) {
                return state;
            }
        }
        return null;
    }

    function requireState(stage, id) {
        var state = getState(stage, id);
        if (!state) {
            throw {
                name: 'MissingStateException',
                message: 'State `' + stage + ':' + id + '` doesn\'t exist'
            }
        }
        return state;
    }

    function transitionTo(stage, id, hints) {
        var nextState = requireState(stage, id),
            transition;
        if (state.execution === ExecutionState.Terminated || state.execution === ExecutionState.Terminating) {
            error('Call to transitionTo() during termination stage');
            return;
        }
        info('Performing transition to state {}:{} with hints {}', stage, id, hints);
        if (state.execution === ExecutionState.Transition) {
            info('Found running transition, aborting');
            abortTransition(state.transition);
            state.transition = null;
            state.execution = ExecutionState.Idle;
        }
        state.execution = ExecutionState.Transition;
        state.transition = transition = createTransition(state.scenario, nextState, hints);
        transition.promise.then(function (result) {
            handleTransitionResolve(transition, result);
        }, function (error) {
            handleTransitionReject(transition, error);
        });
        // launching real transition processing
        transition.trigger.resolve();
        return transition.promise;
    }

    /**
     * @param {Transition} transition
     */
    function abortTransition(transition) {
        var promise;
        transition.cancellation.cancel();
        promise = executeHandler(transition.target.abort, transition.origin, transition.hints);
        promise = timeout(promise, transition.target.timeouts.abort, function (resolve, reject) {
            warn('Transition {}:{} abort has timed out, running rescue handler', transition.target.stage,
                transition.target.id);
            var timeoutPromise = executeHandler(transition.target.onAbortTimeout, transition.origin, transition.hints,
                transition.cancellation);
            timeout(timeoutPromise, transition.target.timeouts.onAbortTimeout)
                .then(resolve, function (error) {
                    error('Transition {}:{} rescue handler has failed: {}', transition.target.stage,
                        transition.target.id, error);
                    reject(error);
                });
        });
        // todo should failed abort process terminate whole scenario?
        return promise;
    }

    /**
     * @param {StateDeclaration} currentState
     * @param {StateDeclaration} nextState
     * @param {object} hints
     *
     * @return {Transition}
     */
    function createTransition(currentState, nextState, hints) {
        var token = new CancellationToken(),
            transition = {
                cancellation: token,
                origin: currentState,
                target: nextState,
                hints: hints,
                trigger: new CompletablePromise()
            };

        transition.promise = transition.trigger.then(function () {
            var buffer = executeHandler(nextState.transition, currentState, hints, token)
                .then(function (result) {
                    return schema.normalizeTransitionResult(result, nextState.stage);
                });
            return timeout(buffer, nextState.timeouts.transition, function (resolve, reject, error) {
                if (token.isCancelled()) {
                    return reject(error);
                }
                warn('Transition to state {}:{} has timed out', nextState.stage, nextState.id);
                var rescueHandler = executeHandler(nextState.onTransitionTimeout, currentState, hints, token);
                timeout(rescueHandler, nextState.timeouts.onTransitionTimeout).then(resolve, function (e) {
                    error('Rescue handler for transition to state {}:{} has failed: {}', nextState.stage, nextState.id, e);
                    reject(e);
                });
            });
        });
        //noinspection JSValidateTypes
        return transition;
    }

    /**
     * @param {Transition} transition
     * @param {TransitionResult} result
     */
    function handleTransitionResolve(transition, result) {
        var arrivedAt = transition.target;
        if (result.transitionedTo) {
            arrivedAt = requireState(result.transitionedTo.stage, result.transitionedTo.id);
            info('Transition to state {}:{} ended in state {}:{}', transition.target.stage, transition.target.id,
                arrivedAt.stage, arrivedAt.id);
        } else {
            info('Scenario has successfully transitioned to {}:{}', arrivedAt.stage, arrivedAt.id);
        }
        history.push(utilities.object.copy(arrivedAt));
        state.execution = ExecutionState.Idle;
        state.transition = null;
        state.scenario = requireState(arrivedAt.stage, arrivedAt.id);
        if (state.timeout) {
            debug('Found timeout from previous state, resolving');
            state.timeout.resolve();
            state.timeout = null;
        }
        if (arrivedAt.timeouts.state) {
            debug('State {}:{} has a timeout of {} ms, setting up', arrivedAt.stage, arrivedAt.id,
                arrivedAt.timeouts.state);
            var timeout = state.timeout = new CompletablePromise();
            timeout(state.timeout, arrivedAt.timeouts.state).then(null, function (error) {
                warn('State {}:{} has reached it\'s timeout of {} ms, running timeout handler', arrivedAt.stage,
                    arrivedAt.id, arrivedAt.timeouts.state);
                var token = new CancellationToken(),
                    promise = executeHandler(arrivedAt.onTimeout, transition.origin, transition.hints, token);
                return timeout(promise, arrivedAt.timeouts.onStateTimeout, function (e) {
                    token.cancel();
                    error('State {}:{} timeout rescue handler has reached it\'s own timeout and will be halt',
                            arrivedAt.stage, arrivedAt.id);
                    return Promise.reject(e);
                });
            }).then(timeout.resolve, timeout.reject);
            timeout.then(null, function (e) {
                error('State {}:{} has reached it\'s timeout and scenario is going to be terminated: {}',
                    arrivedAt.stage, arrivedAt.id, e);
                terminate(timeout, e && e.hints ? e.hints : {});
            });
        }
        if (arrivedAt.terminal) {
            info('Arrived at terminal state {}:{}', arrivedAt.stage, arrivedAt.id);
            return terminate(transition.promise, result.hints || {});
        }
        if (result.trigger) {
            info('Transition to state {}:{} triggered next transition to {}:{} with hints {}', transition.target.stage,
                transition.target.id, result.trigger.stage, result.trigger.id, result.trigger.hints);
            return transitionTo(result.trigger.stage, result.trigger.id, result.trigger.hints);
        }
    }

    /**
     * @param {Transition} transition
     * @param {object} failure
     * @param {object} [failure.hints] Optional hints for onTermination handler
     */
    function handleTransitionReject(transition, failure) {
        error('Transition to state {}:{} ended with failure: {}', transition.target.stage, transition.target.id,
            failure);
        terminate(transition.promise, failure.hints || {});
    }

    function runTerminationHandler(hints) {
        var token = new CancellationToken(),
            handler = executeHandler(scenario.onTermination, hints, token);
        info('Running termination handler with hints {}', hints);
        return timeout(handler, timeouts.onTermination, function (resolve, reject) {
            token.cancel();
            warn('onTermination handler has timed out, running rescue handler');
            var timeoutToken = new CancellationToken(),
                timeoutPromise = executeHandler(scenario.onTerminationTimeout, hints, timeoutToken);
            timeout(timeoutPromise, timeouts.onTerminationTimeout).then(resolve, function (e) {
                timeoutToken.cancel();
                error('onTermination timeout rescue handler has failed as well: {}', e);
                reject(e);
            });
        });
    }

    function terminate(trigger, hints) {
        var promise = runTerminationHandler(hints);
        Promise
            .all(activeProcesses.concat([trigger, promise]))
            .then(function (v) {
                info('Termination sequence has successfully completed');
                completionHook.resolve(v);
                VoxEngine.terminate();
            }, function (e) {
                error('Termination sequence has completed abnormally: {}', e);
                completionHook.reject(e);
                VoxEngine.terminate();
            });
        return completionHook;
    }

    this.run = function (arguments) {
        info('VoxEngine scenario framework');
        info('Running scenario {}', scenario.id);
        info('Scenario version: {}', scenario.version);
        info('Environment: {}', scenario.environment);
        info('Arguments: {}', arguments);
        this.arguments = arguments;
        this.transitionTo(entrypoint.stage, entrypoint.id, {});
        return completionHook;
    };

    //noinspection JSUnusedGlobalSymbols
    this.auto = function () {
        var deserializer = context.settings.argumentsDeserializer || function (v) { return v; },
            self = this;
        if (scenario.trigger.toLowerCase() === schema.TriggerType.Call.toLowerCase()) {
            /**
             * @param {AppEvents.CallAlerting} event
             */
            var handler = function (event) {
                var arguments = deserializer(event.customData);
                utilities.object.overwrite(arguments, event);
                self.run(arguments);
            };
            VoxEngine.addEventListener(AppEvents.CallAlerting, handler);
        } else {
            this.run(deserializer(VoxEngine.customData()));
        }
        return completionHook;
    };

    this.transitionTo = transitionTo;

    // helpers

    //noinspection JSUnusedGlobalSymbols
    this.debug = debug;
    //noinspection JSUnusedGlobalSymbols
    this.info = info;
    //noinspection JSUnusedGlobalSymbols
    this.warn = warn;
    //noinspection JSUnusedGlobalSymbols
    this.error = error;

    this.getCurrentState = function () {
        return state.scenario ? utilities.object.copy(state.scenario) : null;
    };

    this.getCompletionHook = function () {
        return completionHook.then();
    };

    //noinspection JSUnusedGlobalSymbols
    this.getHistory = function () {
        return history.map(utilities.object.copy);
    };
}

exports = module.exports = {
    ScenarioExecution: ScenarioExecution
};