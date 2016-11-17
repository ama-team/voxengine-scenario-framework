var utilities = require('./utility/common'),
    concurrent = require('./utility/concurrent'),
    schema = require('./schema');

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

/**
 * @param {ScenarioDeclaration} scenario Scenario itself
 * @param {object} container Dependency injection container
 *
 * @constructor
 */
function ScenarioExecution(scenario, container) {

    scenario = schema.normalizeScenario(scenario);
    var validationResult = schema.validateScenario(scenario, true);
    if (!validationResult.valid) {
        throw {
            name: 'InvalidScenarioException',
            message: 'Passed scenario is invalid',
            validationResult: validationResult
        }
    }

    // ensuring that states won't be altered
    var states = scenario.states.map(schema.normalizeState);
    var entrypoint = scenario.states.reduce(function (found, candidate) {
        return found ? found : (candidate.entrypoint ? candidate : null);
    });
    var currentState = null;
    var runningTransition = null;
    var onTerminationTimeout = scenario.timeouts.onTermination;
    var settings = scenario.settings;

    this.scenario = scenario;
    this.arguments = {};
    this.container = utilities.object.merge(utilities.object.copy(container || {}, false), scenario.container);
    this.data = {};

    function getState(id, stage) {
        stage = stage || (currentState ? currentState.stage : null);
        if (!stage) {
            throw {
                name: 'IllegalArgumentException',
                message: 'Stage not specified'
            };
        }
        for (var i = 0; i < states.length; i++) {
            var state = states[i];
            if (state.stage === stage && stage.id === id) {
                return state;
            }
        }
        return null;
    }

    function cancelRunningTransition(self) {
        if (!self.runningTransition) {
            return;
        }
        var transition = self.runningTransition;
        self.info('Cancelling running transition to state {}', transition.targetState);
        self.runningTransition = null;

        transition.cancellationToken.cancel();
        var promise = transition.targetState.abort.call(this, self.currentState, transition.hints);
        promise = timeout(promise, transition.targetState.timeouts.abort);
        promise.then(function (success) {
            self.info('Successfully aborted transition to state {}, result: {}', transition.targetState, success)
        }, function (failure) {
            self.warn('Abort process for transition to state {} failed: {}', transition.targetState, failure);
        });
    }

    function execute(self) {
        self.info('VoxEngine scenario framework');
        self.info('Running scenario {}', scenario.id);
        self.info('Scenario version: {}', scenario.version);
        self.info('Environment: {}', scenario.environment);
        self.transitionTo(entrypoint.id, entrypoint.stage, {});
    }

    function terminate(self, hints) {
        var finalization = scenario.onTermination.call(self, hints || {});
        finalization = timeout(finalization, scenario.timeouts.onTermination);
        return finalization
            .then(function (success) {
                self.log('Successfully finished onTermination handler execution: {}', success);
            }, function (failure) {
                self.log('[ERROR] onTermination handler resulted in error: {}', failure);
            })
            .then(function (_) {
                self.log('Terminating VoxImplant session');
                VoxEngine.terminate();
            });
    }

    this.run = function () {
        if (scenario.trigger.toLowerCase() === schema.TriggerType.Call.toLowerCase()) {
            VoxEngine.addEventListener(AppEvents.CallAlerting, function () { execute(this); });
        } else {
            execute(this);
        }
        // todo: return promise that will resolve on termination
    };

    this.transitionTo = function (id, stage, hints) {
        var state = getState(id, stage),
            promise,
            cancellationToken,
            runningTransition;

        if (!state) {
            throw {
                name: 'MissingStateException',
                message: 'State `' + stage + ':' + id + '` doesn\'t exist'
            }
        }

        cancelRunningTransition();

        cancellationToken = {
            cancelled: false,
            isCancelled: function () {
                return this.cancelled;
            },
            cancel: function () {
                this.cancelled = true;
            }
        };
        runningTransition = {
            targetState: state,
            cancellationToken: cancellationToken,
            hints: hints
        };
        promise = state.transition.call(this, currentState, hints, cancellationToken);
        promise = timeout(promise, state.timeouts.transition);

        runningTransition.promise = promise = concurrent.timeout(promise, state.timeouts.transition);
        this.runningTransition = runningTransition;
        // todo: unfinished
    };

    // helpers

    this.log = function (message, parameters) {
        this.container.logger.write(message, parameters);
    };

    // todo: move to logger in voxengine sdk
    this.info = function (message, parameters) {
        this.log('[INFO] ' + message, parameters);
    };

    this.warn = function (message, parameters) {
        this.log('[WARN] ' + message, parameters);
    };

    this.error = function (message, parameters) {
        this.log('[ERROR] ' + message, parameters);
    };

    this.getCurrentState = function () {
        return currentState ? schema.normalizeState(currentState) : null;
    };
}

exports = module.exports = {
    ScenarioExecution: ScenarioExecution
};