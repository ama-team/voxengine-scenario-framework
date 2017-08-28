/**
 * @typedef {object} TState
 *
 * @property {TStateId} id
 * @property {boolean} entrypoint
 * @property {boolean} terminal
 * @property {TStateHandler} transition
 * @property {TStateHandler} abort
 * @property {int} timeout
 * @property {TStateId|TStateTrigger} triggers
 */
