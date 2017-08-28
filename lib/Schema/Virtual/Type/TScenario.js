/**
 * @typedef {object} TScenario
 *
 * @property {string|null} [id]
 * @property {string|null} [version]
 * @property {string|null} [environment]
 * @property {object.<TStateId, TState>} states
 * @property {TErrorHandler} errorHandler
 * @property {TTerminationHandler} terminationHandler
 * @property {int|null} timeout
 */
