/**
 * @typedef {object} State
 *
 * @property {StateId} id
 * @property {boolean} entrypoint
 * @property {boolean} terminal
 * @property {IHandler} transition
 * @property {IHandler} onTransitionTimeout
 * @property {IHandler} abort
 * @property {Function} onAbortTimeout
 * @property {Timeouts} timeouts
 * @property {StateId|StateTrigger} triggers
 */
