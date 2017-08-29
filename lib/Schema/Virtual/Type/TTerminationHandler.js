/**
 * @callback TTerminationHandler~Callback
 *
 * @param {TScenarioResult} result
 *
 * @return {Thenable}
 */

/**
 * @typedef {object} TTerminationHandler
 *
 * @property {string} id
 * @property {TTerminationHandler~Callback} handler
 * @property {int|null} timeout
 * @property {TTerminationHandler|null} [onTimeout]
 */
