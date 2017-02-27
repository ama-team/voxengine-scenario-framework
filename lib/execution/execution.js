var concurrent = require('../utility/concurrent'),
    CompletablePromise = concurrent.CompletablePromise,
    CancellationToken = concurrent.CancellationToken,
    timeout = concurrent.safeTimeout,
    utilities = require('../utility/common'),
    schema = require('../schema/definitions'),
    ExecutionResult = schema.ExecutionResult,
    MachineTerminationResult = schema.MachineTerminationResult;

/**
 * @enum
 * @readonly
 */
var ExecutionStatus = {
    Idle: 'Idle',
    Running: 'Running',
    Terminating: 'Terminating',
    Terminated: 'Terminated'
};

/**
 * This class resembles full scenario execution.
 *
 * @class
 *
 * @param {Scenario} scenario Scenario to execute.
 * @param {StateMachine} machine State machine.
 * @param {ExecutionRuntime} runtime Execution runtime.
 * @param {VarArgLogger} logger Logger instance.
 *
 * @property {AppEvents.CallAlerting|null} trigger CallAlerting event that triggered the scenario
 * @property {AppEvents.Started} start Application start event
 */
function Execution(scenario, machine, runtime, logger) {
    var completion = new CompletablePromise(),
        termination = completion.then(terminate, function (e) { return terminate(ExecutionResult.failure(e)); }),
        status = ExecutionStatus.Idle,
        scenarioTimeout;

    function setStatus(s) {
        logger.debug('Execution has transitioned from status `{}` to `{}`', status, s);
        status = s;
        runtime.executionStatus = s;
    }

    function run() {
        if (status !== ExecutionStatus.Idle) {
            return Promise.resolve(ExecutionResult.illegal('Tried to start already started execution'));
        }
        logger.info('Executing scenario {}', scenario.toString());
        logger.info('Scenario arguments: {}', runtime.arguments);
        setStatus(ExecutionStatus.Running);
        if (scenario.timeouts.scenario > 0) {
            scenarioTimeout = setTimeout(function () {
                completion.resolve(ExecutionResult.scenarioTimeout());
            }, scenario.timeouts.scenario);
        }
        machine.run().then(function (result) {
            if (!(result instanceof MachineTerminationResult)) {
                var e = new Error('Unexpected state machine result');
                e.result = result;
                completion.resolve(ExecutionResult.failure(e));
            } else {
                completion.resolve(new ExecutionResult(result.cause, result.error, result.state));
            }
        }, function (e) {
            completion.resolve(ExecutionResult.failure(e));
        });
        completion.then(machine.stop);
        return termination;
    }

    /**
     * Executes termination handler
     *
     * @return {Promise}
     */
    function runTerminationHandler() {
        var token = new CancellationToken(),
            future;
        try {
            future = runtime.execute(scenario.onTermination, token);
        } catch (e) {
            return Promise.reject(e);
        }
        logger.debug('Running termination handler');
        return timeout(future, scenario.timeouts.onTermination, function (res, rej, e) {
            token.cancel();
            logger.warn('Scenario termination handler has timed out');
            var localToken = new CancellationToken(),
                rescue = runtime.execute(scenario.onTerminationTimeout, localToken, e);
            timeout(rescue, scenario.timeouts.onTerminationTimeout, function (res2, rej2) {
                localToken.cancel();
                logger.error('Scenario termination rescue handler has timed out as well');
                rej2(e);
            }).then(res, rej);
        });

    }

    /**
     * Performs termination sequence.
     *
     * @param {ExecutionResult} result
     * @return {Promise}
     */
    function terminate(result) {
        setStatus(ExecutionStatus.Terminating);
        if (scenarioTimeout) { clearTimeout(scenarioTimeout); }
        return runTerminationHandler()
            .then(utilities.functions.NoOp, function (e) {
                logger.error('Termination handler has failed with error {}', e.name);
                result.terminationError = e;
                result.success = false;
            })
            .then(function () {
                setStatus(ExecutionStatus.Terminated);
                return result;
            });
    }
    
    /**
     * Scenario run entry point.
     *
     * @function
     *
     * @return {Promise.<ExecutionResult>} Termination promise that will resolve once scenario has finished
     */
    this.run = run;

    //noinspection JSUnusedGlobalSymbols
    /**
     * Returns promise that will be resolved with {ExecutionResult} once scenario has finished successfully or
     * exceptionally.
     *
     * @return {Promise.<ExecutionResult>}
     */
    this.getTermination = function () {
        return termination;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Returns scenario this execution is bind to.
     *
     * @return {Scenario}
     */
    this.getScenario = function () {
        return scenario;
    };

    /**
     * Returns dependency injection container.
     *
     * @return {Object}
     */
    this.getContainer = function () {
        return runtime.container;
    };

    /**
     * @return {ExecutionRuntime}
     */
    this.getRuntime = function () {
        return runtime;
    };
}

exports = module.exports = {
    ExecutionStatus: ExecutionStatus,
    Execution: Execution
};