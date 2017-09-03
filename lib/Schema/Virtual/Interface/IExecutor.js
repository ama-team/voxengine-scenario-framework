/**
 * Class for user code execution. Executes code in context of
 * {@see IExecutionContext}, passing it as `this`
 *
 * @interface IExecutor
 */

/**
 * @function IExecutor#execute
 *
 * @template TReturnType
 *
 * @param {Function.<TReturnType>} callable
 * @param {*[]} [args]
 *
 * @return {TReturnType|*}
 */

/**
 * @function IExecutor#promise
 *
 * @template TReturnType
 *
 * @param {Function.<TReturnType>} callable
 * @param {*[]} [args]
 *
 * @return {Thenable.<TReturnType|Error|*>}
 */

/**
 * @function IExecutor#runHandler
 *
 * @param {THandler} handler
 * @param {*[]} [args]
 * @param {CancellationToken} [token]
 * @param {int} [tokenArg] Index of cancellation token argument in arguments
 *   array
 */

/**
 * @function IExecutor#getContext
 *
 * @return IExecutionContext
 */
