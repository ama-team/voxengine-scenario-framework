/**
 * @typedef {object} TScenarioInput
 *
 * @property {string|null} [id]
 * @property {string|null} [environment]
 * @property {string|null} [version]
 * @property {object.<TStateId, TState>} states
 * @property {TTerminationHandler|Function|null} [onTermination]
 * @property {TErrorHandler|Function|null} [onError]
 * @property {object.<string, int>|null} [timeouts]
 */
