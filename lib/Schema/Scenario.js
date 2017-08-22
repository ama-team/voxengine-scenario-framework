/**
 * @typedef {object} Scenario
 *
 * @property {string|null} [id]
 * @property {string|null} [version]
 * @property {string|null} [environment]
 * @property {object.<string, State>} states
 * @property {State} entrypoint
 * @property {State} onError
 * @property {TriggerType} trigger
 * @property {Timeouts} timeouts
 */
