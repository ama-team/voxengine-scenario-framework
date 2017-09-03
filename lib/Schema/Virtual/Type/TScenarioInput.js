/**
 * @typedef {object} TScenarioInput
 *
 * @property {TriggerType} trigger
 * @property {object.<TStateId, TState>} states
 * @property {string|null} [id]
 * @property {string|null} [environment]
 * @property {string|null} [version]
 * @property {object|null} [arguments]
 * @property {object|null} [state]
 * @property {TTerminationHandler|TTerminationHandler~Callback|null} [onTermination]
 * @property {TErrorHandler|TErrorHandler~Callback|null} [onError]
 * @property {object.<string, int>|null} [timeouts]
 * @property {TArgumentHandler|TArgumentHandler~Callback|null} [deserializer]
 */
