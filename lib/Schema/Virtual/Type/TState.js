/**
 * @typedef {object} TState
 *
 * @property {TStateId} id
 * @property {boolean} entrypoint
 * @property {boolean} terminal
 * @property {TStateHandler} transition
 * @property {TStateHandler} onTransitionTimeout
 * @property {TStateHandler} abort
 * @property {TStateHandler} onAbortTimeout
 * @property {int} timeout
 * @property {TStateId|TStateTrigger} triggers
 */
