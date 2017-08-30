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
 * @property {TTerminationHandler|Function|null} [onTermination]
 * @property {TErrorHandler|Function|null} [onError]
 * @property {object.<string, int>|null} [timeouts]
 * @property {FEnvironmentDeserializer} [argumentDeserializer]
 */
