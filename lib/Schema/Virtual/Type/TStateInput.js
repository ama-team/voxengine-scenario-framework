/**
 * @typedef {object} TStateInput
 *
 * @property {boolean} [entrypoint]
 * @property {boolean} [terminal]
 * @property {TStateHandler|Function} [transition]
 * @property {TStateHandler|Function} [abort]
 * @property {int|null} [timeout]
 * @property {TStateId|TStateTrigger|null} [triggers]
 */
