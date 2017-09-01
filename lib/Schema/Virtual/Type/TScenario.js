/**
 * @typedef {object} TScenario
 *
 * @property {string|null} [id]
 * @property {string|null} [version]
 * @property {string|null} [environment]
 * @property {object.<TStateId, TState>} states
 * @property {TErrorHandler} onError
 * @property {TTerminationHandler} onTermination
 * @property {int|null} timeout
 * @property {TriggerType} trigger
 */
