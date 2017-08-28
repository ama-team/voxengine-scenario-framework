/**
 * @typedef {object} TScenario
 *
 * @property {string|null} [id]
 * @property {string|null} [version]
 * @property {string|null} [environment]
 * @property {object.<TStateId, TState>} states
 * @property {TScenario~errorHandler} errorHandler
 */

/**
 * @callback TScenario~errorHandler
 *
 * @param {Error|*} error
 * @param {TStateId} [origin]
 * @param {TStateId} [target]
 * @param {THints} [hints]
 */
