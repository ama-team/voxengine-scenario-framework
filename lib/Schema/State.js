/**
 * @typedef {object} State
 *
 * @property {StateId} id
 * @property {boolean} entrypoint
 * @property {boolean} terminal
 * @property {IHandler} transition
 * @property {IHandler} onTransitionTimeout
 * @property {IHandler} abort
 * @property {IHandler} onAbortTimeout
 * @property {int} timeout
 * @property {StateId|StateTrigger} triggers
 */
