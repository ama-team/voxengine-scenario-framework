/**
 * @typedef TStateHandler~Callback
 *
 * @param {TStateId} previousState
 * @param {THints} hints
 * @param {CancellationToken} token
 * @param {TimeoutException} [error] Error because of which timeout handler
 *   has been called.
 */

/**
 * @typedef {object} TStateHandler
 *
 * @property {string|null} [id]
 * @property {TStateHandler~Callback} handler
 * @property {int|null} timeout
 * @property {TStateHandler|null} timeoutHandler
 */
