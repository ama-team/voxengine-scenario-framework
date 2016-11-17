var schema = require('./schema'),
    execution = require('./scenario-execution');

exports = module.exports = {
    prepare: function (scenario) {
        var container = {
            logger: Logger
        };
        return new execution.ScenarioExecution(scenario);
    },
    validate: schema.validateScenario,
    normalize: schema.normalizeScenario,
    TriggerType: schema.TriggerType
};