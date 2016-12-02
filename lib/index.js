var Execution = require('./execution/execution').Execution,
    ExecutionRuntime = require('./execution/runtime').ExecutionRuntime,
    StateMachine = require('./execution/state-machine').StateMachine,
    schema = require('./schema/definitions'),
    TriggerType = schema.TriggerType,
    validator = require('./schema/validator'),
    normalizer = require('./schema/normalizer').Schema,
    loggers = require('@ama-team/voxengine-sdk').loggers;

//noinspection JSUnusedLocalSymbols
/**
 * This structure describes settings that may be passed to create new execution.
 *
 * @class
 *
 * @property {ExecutionSettings.customDataDeserializer} customDataDeserializer
 * @property {object} container
 * @property {object} data Pre-populated user data
 * @property {LogLevel} logLevel
 */
function ExecutionSettings() {
    this.customDataDeserializer = null;
    this.container = {};
    this.data = {};
    this.logLevel = loggers.LogLevel.Info;
}

/**
 * This handler deserializes VoxImplant customData string into arguments object. Please note that exceptions are not
 * allowed and has to be swallowed.
 *
 * @callback ExecutionSettings.customDataDeserializer
 *
 * @param {string|null|undefined} customData String to deserializer. Please note that i t may be null/undefined.
 *
 * @return {object} Deserialized arguments. This object will be used by user scenario handlers only, so it may have any
 *   type.
 */

/**
 * Creates {Execution} instance in a user-friendly way.
 *
 * @param {Scenario|object} scenario Scenario (usually, non-normalized) that will be used by execution.
 * @param {object} [container] Dependency injection container.
 * @param {object} [logLevel] Log level to use.
 * @param {object} [arguments] Arguments to run scenario with, this is usually fetched from custom data.
 * @param {object} [data] Pre-populated runtime data object.
 *
 * @return {Execution}
 */
function compose(scenario, container, arguments, data, logLevel) {
    var validation,
        runtime,
        logger,
        machine,
        violations;

    scenario = normalizer.scenario(scenario);
    validation = validator.validate(scenario);
    logLevel = typeof logLevel === 'undefined' ? loggers.LogLevel.Info : logLevel;
    container = container || {};
    logger = container.logger = container.logger ? container.logger : new loggers.slf4j(Logger, logLevel);

    violations = Object.keys(validation.violations)
        .map(function (k) {
            return validation.violations[k].map(function (v) {
                return k + ': ' + v;
            }).reduce(function (a, b) {
                return a.concat(b);
            }, []);
        });
    if (!validation.valid) {
        throw new Error('Scenario hasn\'t passed validation:\n\n - ' + violations.join('\n - '));
    }
    violations.forEach(function (v) {
        logger.warn('Scenario validation warning: {}', v);
    });

    runtime = new ExecutionRuntime({logger: logger}, arguments, data);
    machine = new StateMachine(scenario.states, runtime, logger);
    return new Execution(scenario, machine, runtime, logger);
}

/**
 * Takes incoming script and runs it whenever corresponding trigger is called.
 *
 * @param {Scenario|object} scenario Scenario (normalized or not) that has to be executed.
 * @param {ExecutionSettings|object} settings User-defined settings.
 */
function run(scenario, settings) {
    var container = settings.container || {},
        logLevel = settings.logLevel,
        data = settings.data || {};
    if (scenario.trigger === TriggerType.Call) {
        /** @param {Call} call */
        var handler = function (call) {
            execute(compose(scenario, container, deserializeArguments(call.customData(), settings), data, logLevel));
        };
        VoxEngine.addEventListener(AppEvents.CallAlerting, handler);
        return;
    }
    execute(compose(scenario, container, deserializeArguments(VoxEngine.customData(), settings), data, logLevel));
}

/**
 * Helper function that deals with scenario post-processing.
 *
 * @param {Execution} execution
 * @return {Promise}
 */
function execute(execution) {
    var logger = execution.getContainer().logger;
    return execution.run().then(function (result) {
        if (!result.success) {
            logger.error('Scenario has terminated unsuccessfully with cause `' + result.cause + '`');
            logger.error('Scenario error:', result.error);
            logger.error('Scenario termination error: ', result.terminationError);
        }
        VoxEngine.terminate();
        return result;
    }, function (error) {
        logger.error('Scenario has terminated with an error:', error);
        VoxEngine.terminate();
        return error;
    });
}

/**
 * Deserializes custom data into scenario arguments.
 *
 * @param {string} customData
 * @param {ExecutionSettings|object} settings
 *
 * @return {object} Deserialized arguments
 */
function deserializeArguments(customData, settings) {
    if (!settings.customDataDeserializer) {
        return customData || {};
    }
    return settings.customDataDeserializer(customData) || {};
}

exports = module.exports = {
    run: run,
    compose: compose,
    validate: validator.validate,
    normalize: normalizer.scenario,
    TriggerType: TriggerType
};