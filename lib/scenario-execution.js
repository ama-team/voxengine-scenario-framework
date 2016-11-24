var utilities = require('./utility/common'),
    concurrent = require('./utility/concurrent'),
    CancellationToken = concurrent.CancellationToken,
    CompletablePromise = concurrent.CompletablePromise,
    TimeoutException = concurrent.TimeoutException,
    schema = require('./schema'),
    ScenarioResult = schema.ScenarioResult,
    ScenarioExecutionException = schema.ScenarioExecutionException,
    TriggerType = schema.TriggerType,
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

var TransitionState = {
    Idle: 'Idle',
    Running: 'Running',
    Finished: 'Finished',
    Failed: 'Failed',
    Aborted: 'Aborted'
};

var NullState = {id: null};

function ConsecutiveTransitionStartException(message) {
    this.name = 'ConsecutiveTransitionStartException';
    this.message = message || 'Transition has been started second time';
    this.stack = (new Error()).stack;
}
ConsecutiveTransitionStartException.prototype = Object.create(Error.prototype);
ConsecutiveTransitionStartException.prototype.constructor = ConsecutiveTransitionStartException;

function IdleTransitionAbortException(message) {
    this.name = 'IdleTransitionAbortException';
    this.message = message || 'Tried to abort idle transition';
    this.stack = (new Error()).stack;
}
IdleTransitionAbortException.prototype = Object.create(Error.prototype);
IdleTransitionAbortException.prototype.constructor = ConsecutiveTransitionStartException;

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

    // region initialization

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
    /**
     * This promise has to be resolved with ScenarioResult once scenario has reached terminal state.
     *
     * @type {CompletablePromise}
     */
    var completion = new CompletablePromise(),
        /**
         * This promise has to be resolved once scenario has been terminated.
         *
         * @type {Promise}
         */
        termination = completion.then(function (result) {
            return runTerminationSequence(result);
        }),
        /**
         * List of known states.
         *
         * @type {StateDeclaration[]}
         */
        states = scenario.states.map(schema.normalizeState),
        /**
         * State that has to be executed first.
         *
         * @type {StateDeclaration}
         */
        entrypoint = scenario.states.reduce(function (found, candidate) {
            return found ? found : (candidate.entrypoint ? candidate : null);
        }),
        /**
         * Some NullValue defaults that will let avoid undefined pointer exception
         *
         * @type {object}
         */
        defaultContainer = {
            logger: { log: function () {} }
        },
        /**
         * The real container
         */
        container = utilities.objects.overwrite(defaultContainer, context.container || {}, false),
        /**
         * List of (promises) running right now.
         * @type {Array}
         */
        processes = [],
        /**
         * Current execution state
         */
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
        scenarioTimeout;

    this.scenario = scenario;
    this.arguments = {};
    this.container = container;
    this.data = {};

    // endregion

    // region logging

    function log(level, message, parameters) {
        container.logger.log.apply(container.logger, [level, message].concat(parameters));
    }

    function logDebug(message) {
        log(LogLevel.DEBUG, message, Array.prototype.slice.call(arguments, 1));
    }

    function logInfo(message) {
        log(LogLevel.INFO, message, Array.prototype.slice.call(arguments, 1));
    }

    function logWarn(message) {
        log(LogLevel.WARN, message, Array.prototype.slice.call(arguments, 1));
    }

    function logError(message) {
        log(LogLevel.ERROR, message, Array.prototype.slice.call(arguments, 1));
    }

    // endregion

    // region states

    function getState(id) {
        return states.reduce(function (m, s) { return m || s.id !== id ? m : s; }, null);
    }

    function requireState(id) {
        var state = getState(id);
        if (!state) {
            throw {
                name: 'MissingStateException',
                message: 'State `' + id + '` doesn\'t exist',
                stack: (new Error()).stack
            }
        }
        return state;
    }

    function setState(id) {
        var s = requireState(id);
        logInfo('Scenario has transitioned to state {}', id);
        history.push(s);
        state.scenario = s;
        if (s.timeouts.state && s.timeouts.state > 0) {
            setStateTimeout(s);
        }
    }

    function setStateTimeout(s) {
        clearStateTimeout();
        var timer;
        if (!s.timeouts.state || s.timeouts.state <= 0) {
            return;
        }
        logInfo('State `{}` specifies timeout of {} ms, applying', s.id, s.timeouts.state);
        timer = timeout(state.timeout, s.timeouts.state, function (resolve, reject, error) {
            logWarn('State `{}` has timed out, running rescue handler', s.id);
            var token = new CancellationToken(),
                handler = executeHandler(s.onTimeout, error, token);
            return timeout(handler, state.timeout.onTimeout, function (_, reject, e) {
                logError('Timeout rescue handler for state `{}` has failed', s.id);
                token.cancel();
                reject(e);
            }).then(resolve, reject);
        });
        timer.then(null, function (e) {
            logError('State timeout has finished with an error', e);
            // todo hints
            terminate(ScenarioResult.timeout(e, {}));
        });
    }

    function clearStateTimeout() {
        if (state.timeout) {
            logDebug('Clearing state timeout');
            state.timeout.resolve();
            state.timeout = null;
        }
    }

    // endregion

    // region processes

    function registerBackgroundProcess(process, name) {
        logDebug('Registering new process "{}" ({})', name, process.toString());
        processes.push({process: process, name: name});
        var clean = function () {
            logDebug('Cleaning process "{}"', name);
            processes = processes.filter(function (item) {
                return item.process !== process;
            });
        };
        process.then(clean, function (e) {
            logError('Unhandled async process "{}" ({}) exception: {}', name, process, e);
            clean();
        });
        return process;
    }

    // endregion

    // region transition

    function rescueTransition(currentState, nextState, hints, cancellationToken, error) {
        if (cancellationToken.isCancelled()) {
            logWarn('Could not run transition `{}` -> `{}` rescue handler: already cancelled', currentState.id,
                nextState.id);
            return Promise.reject(error);
        }
        logInfo('Running transition `{}` -> `{}` rescue handler', currentState.id, nextState.id);
        var localToken = new CancellationToken(cancellationToken),
            promise = executeHandler(nextState.onTransitionTimeout, currentState, nextState, hints, localToken, error);
        promise = timeout(promise, nextState.timeouts.onTransitionTimeout, function (resolve, reject, error) {
            logError('Transition `{}` -> `{}` rescue handler has timed out', currentState.id, nextState.id);
            localToken.cancel();
            reject(error);
        });
        return promise;
    }

    function performTransition(currentState, nextState, hints, cancellationToken) {
        var localToken = new CancellationToken(cancellationToken),
            promise;

        logInfo('Performing transition `{}` -> `{}` with hints {}', currentState.id, nextState.id, hints);
        promise = executeHandler(nextState.transition, currentState, hints, localToken);
        return timeout(promise, nextState.timeouts.transition, function (resolve, reject, error) {
            logWarn('Transition `{}` -> `{}` has timed out, running rescue handler', currentState.id, nextState.id);
            localToken.cancel();
            rescueTransition(currentState, nextState, hints, cancellationToken, error)
                .then(resolve, reject);
        });
    }
    
    function rescueTransitionAbort(currentState, nextState, hints, cancellationToken, error) {
        if (cancellationToken.isCancelled()) {
            logWarn('Could not run transition `{}` -> `{}` abort rescue handler: already cancelled', currentState.id,
                nextState.id);
            return Promise.reject(error);
        }
        logInfo('Running transition `{}` -> `{}` abort rescue handler', currentState.id, nextState.id);
        var localToken = new CancellationToken(cancellationToken),
            promise = executeHandler(nextState.onAbortTimeout, currentState, nextState, hints, localToken);

        return timeout(promise, nextState.timeouts.onAbortTimeout, function (resolve, reject, error) {
            logError('Transition `{}` -> `{}` abort rescue handler has timed out', currentState.id, nextState.id);
            localToken.cancel();
            reject(error);
        });
    }

    function performTransitionAbort(currentState, nextState, hints, transitionCancellationToken) {
        var promise,
            localToken = new CancellationToken();
        transitionCancellationToken.cancel();
        promise = executeHandler(nextState.abort, currentState, hints, localToken);
        return timeout(promise, nextState.timeouts.abort, function (resolve, reject, error) {
            logWarn('Transition `{}` -> `{}` abort has timed out, running rescue handler', currentState.id,
                nextState.id);
            localToken.cancel();
            rescueTransitionAbort(currentState, nextState, hints, error)
                .then(resolve, reject);
        });
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
            c = {
                resolve: null,
                reject: null
            },
            transition = {
                cancellation: token,
                origin: currentState,
                target: nextState,
                hints: hints,
                state: TransitionState.Idle,
                promise: new Promise(function (resolve, reject) {
                    c.resolve = resolve;
                    c.reject = reject;
                }),
                toString: function () {
                    return '`' + currentState.id + '` -> `' + nextState.id + '`';
                }
            };

        transition.run = function () {
            if (transition.state !== TransitionState.Idle) {
                var message = 'Tried to run already started transition ' + transition;
                logError(message);
                return Promise.reject(new ConsecutiveTransitionStartException(message));
            }
            transition.state = TransitionState.Running;
            logDebug('Started transition {}', transition.toString());
            performTransition(currentState, nextState, hints, token).then(function (v) {
                if (token.isCancelled()) {
                    transition.state = TransitionState.Aborted;
                    logDebug('Transition {} has ended after abort', transition.toString());
                    c.resolve({});
                    return;
                }
                v = schema.normalizeDirective(v);
                v.transitionedTo = v.transitionedTo || nextState.id;
                transition.state = TransitionState.Finished;
                logDebug('Transition {} has finished', transition.toString());
                c.resolve(v);
            }, function (e) {
                transition.state = TransitionState.Failed;
                transition.error = e;
                logError('Transition {} has ended with error: {}', transition.toString(), e);
                c.reject(e);
            });
            return transition.promise;
        };

        transition.abort = function () {
            if (transition.state !== TransitionState.Running) {
                var message = 'Tried to abort transition ' + transition + ' that is not running';
                logError(message, currentState.id, nextState.id);
                return Promise.reject(new IdleTransitionAbortException(message));
            }
            return performTransitionAbort(currentState, nextState, hints, token)
                .then(null, function (e) {
                    logError('Transition {} abort has finished with error: {}', transition.toString(), e);
                    return Promise.reject(e);
                });
        };

        //noinspection JSValidateTypes
        return transition;
    }

    function abortRunningTransition() {
        if (state.execution !== ExecutionState.Transition) {
            return Promise.resolve();
        }
        var t = state.transition;
        logInfo('Aborting running transition {}', t.toString());
        state.execution = ExecutionState.Idle;
        return registerBackgroundProcess(state.transition.abort(), 'transition ' + t.toString());
    }

    function transitionTo(id, hints) {
        var nextState = requireState(id),
            currentState = state.scenario || NullState,
            transition,
            promise;
        if (state.execution === ExecutionState.Terminated || state.execution === ExecutionState.Terminating) {
            logError('Call to transitionTo() during termination stage');
            return;
        }
        hints = hints || {};
        logInfo('Transitioning to state `{}` with hints {}', id, hints);
        if (state.execution === ExecutionState.Transition) {
            abortRunningTransition();
        }
        state.execution = ExecutionState.Transition;
        state.transition = transition = createTransition(currentState, nextState, hints);

        promise = transition.run().then(function (v) {
            if (!transition.cancellation.isCancelled()) {
                state.transition = null;
                state.execution = ExecutionState.Idle;
                return processDirective(v);
            }
        }, function (error) {
            state.transition = null;
            state.execution = ExecutionState.Idle;
            var result;
            if (error instanceof TimeoutException) {
                result = ScenarioResult.transitionTimeout(nextState, error, hints);
            } else {
                result = ScenarioResult.transitionFail(nextState, error, hints);
            }
            return terminate(result);
        });
        return registerBackgroundProcess(promise, 'transition ' + transition.toString());
    }

    // endregion

    function timeoutScenario(error) {
        if (state.scenario === ExecutionState.Terminating || state.scenario === ExecutionState.Terminated) {
            logWarn('Scenario timeout called during termination sequence, ignoring');
            return;
        }
        logInfo('Performing scenario timeout sequence');
        if (state.scenario === ExecutionState.Transition) {
            logInfo('Found running transition {}, aborting', state.transition.toString());
            abortRunningTransition();
        }
        return terminate(ScenarioResult.timeout(error, error.hints || {}));
    }

    /**
     * Processes directive received from transition or onTimeout call
     *
     * @param {Directive} directive
     */
    function processDirective(directive) {
        try {
            if (state.execution === ExecutionState.Terminating || state.execution === ExecutionState.Terminated) {
                logError('Received post-terminate processDirective call, ignoring');
                return;
            }
            if (state.execution === ExecutionState.Transition) {
                logInfo('Found active transition, aborting');
                abortRunningTransition();
            }
            var s = directive.transitionedTo,
                t = directive.trigger;
            logDebug('Processing directive {}', directive);
            state.execution = ExecutionState.Idle;
            logInfo('Reached state `{}`', s);
            state.scenario = requireState(s);
            if (state.scenario.terminal) {
                logInfo('Terminal state `{}` reached', s);
                terminate(ScenarioResult.successful(state.scenario, directive.termination.hints));
                return;
            }
            if (t.id) {
                logInfo('Received directive triggers transition to `{}` with hints {}', t.id, t.hints);
                transitionTo(t.id, t.hints);
            }
        } catch (e) {
            e.stack = e.stack || (new Error()).stack;
            terminate(ScenarioResult.unexpectedException(e));
        }
    }

    // region termination

    function runTerminationHandler(hints) {
        var token = new CancellationToken(),
            handler = executeHandler(scenario.onTermination, hints, token);
        logInfo('Running termination handler with hints {}', hints);
        return timeout(handler, scenario.timeouts.onTermination, function (resolve, reject) {
            token.cancel();
            logWarn('onTermination handler has timed out, running rescue handler');
            var timeoutToken = new CancellationToken(),
                timeoutPromise = executeHandler(scenario.onTerminationTimeout, hints, timeoutToken);
            timeout(timeoutPromise, scenario.timeouts.onTerminationTimeout).then(resolve, function (e) {
                timeoutToken.cancel();
                logError('onTermination timeout rescue handler has failed as well: {}', e);
                reject(e);
            });
        });
    }

    function runTerminationSequence(result, hints) {
        if (state.scenario === ExecutionState.Terminating || state.scenario === ExecutionState.Terminated) {
            logWarn('Terminate called for second time with result {}', result.status);
            return termination;
        }
        logInfo('Running termination sequence with result {}', result.status);
        if (state.scenario === ExecutionState.Transition) {
            logInfo('Found active transition, aborting');
            abortRunningTransition();
        }
        state.scenario = ExecutionState.Terminating;
        // todo hints
        var handler = runTerminationHandler(hints);
        return Promise
            .all(processes)
            .then(function() { return handler; })
            .then(function () {
                logInfo('Termination sequence has successfully completed');
                state.scenario = ExecutionState.Terminated;
                if (result.successful) {
                    return result;
                } else {
                    return Promise.reject(new ScenarioExecutionException(result));
                }
            }, function (e) {
                state.scenario = ExecutionState.Terminated;
                logError('Termination sequence has completed abnormally: {}', e);
                result.terminationError = e;
                result.successful = false;
                return Promise.reject(new ScenarioExecutionException(result));
            });
    }

    function terminate(scenarioResult) {
        return completion.resolve(scenarioResult);
    }

    // endregion

    // region run

    /**
     * Runs scenario, returning promise that will resolve/reject once scenario has fully run.
     *
     * @param {object} [args] Scenario arguments
     * @param {object} [hints] Additional hints for entrypoint state
     *
     * @return {ScenarioResult}
     */
    this.run = function (args, hints) {
        hints = hints || {};
        logInfo('VoxEngine scenario framework');
        logInfo('Running scenario {}, version {}, environment {}', scenario.id, scenario.version, scenario.environment);
        logDebug('Arguments: {}', args);
        this.arguments = args;
        if (scenario.timeouts.scenario && scenario.timeouts.scenario > 0) {
            logDebug('Setting scenario timeout to {} ms', scenario.timeouts.scenario);
            timeout(completion, scenario.timeouts.scenario, function (resolve, reject, error) {
                timeoutScenario(error);
                // no point in creating unhandled rejected promise
                resolve();
            });
        }
        this.transitionTo(entrypoint.id, hints);
        return termination;
    };

    // endregion

    // region public-interface

    //noinspection JSUnusedGlobalSymbols
    this.auto = function () {
        var deserializer = context.settings.argumentsDeserializer || function (v) { return v; },
            self = this,
            callback = function () {
                VoxEngine.terminate();
            };
        if (scenario.trigger.toLowerCase() === TriggerType.Call.toLowerCase()) {
            /** @param {AppEvents.CallAlerting} event */
            var handler = function (event) {
                var arguments = deserializer(event.customData);
                utilities.object.overwrite(arguments, event);
                self.run(arguments);
            };
            VoxEngine.addEventListener(AppEvents.CallAlerting, handler);
        } else {
            this.run(deserializer(VoxEngine.customData()));
        }
        termination.then(callback, callback);
    };

    this.transitionTo = transitionTo;

    // helpers

    //noinspection JSUnusedGlobalSymbols
    this.debug = logDebug;
    //noinspection JSUnusedGlobalSymbols
    this.info = logInfo;
    //noinspection JSUnusedGlobalSymbols
    this.warn = logWarn;
    //noinspection JSUnusedGlobalSymbols
    this.error = logError;

    //noinspection JSUnusedGlobalSymbols
    this.getCurrentState = function () {
        return state.scenario ? utilities.object.copy(state.scenario) : null;
    };

    this.getTerminationHook = function () {
        return termination.then();
    };

    //noinspection JSUnusedGlobalSymbols
    this.getHistory = function () {
        return history.map(utilities.object.copy);
    };

    // endregion
}

exports = module.exports = {
    ScenarioExecution: ScenarioExecution
};