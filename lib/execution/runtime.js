/**
 * Runtime object that will be supplied to userspace functions as `this`.
 *
 * @class
 *
 * @param {object} container Dependency injection container
 * @param {InterpolationLoggerInterface} container.logger Logger instance
 * @param {object} [args] Scenario arguments (i.e. parsed custom data)
 * @param {object} [data] Scenario runtime data (used by user functions)
 *
 * @property {object} arguments
 * @property {object} data
 * @property {object} container
 * @property {State} scenarioState Current scenario state
 * @property {Reporter} executionStatus Current execution status
 */
function ExecutionRuntime (container, args, data) {
  this.arguments = args || {}
  this.data = data || {}
  this.container = container || {}
  this.scenarioState = null
  this.executionStatus = null

  function log (level, message) {
    // noinspection JSPotentiallyInvalidUsageOfThis
    return this.container.logger[level].apply(Array.prototype.slice.call(arguments, 1))
  }

  /**
   * @function ExecutionRuntime#debug
   * @param {string} message
   * @param {object...} [parameters]
   */

  /**
   * @function ExecutionRuntime#info
   * @param {string} message
   * @param {object...} [parameters]
   */

  /**
   * @function ExecutionRuntime#warn
   * @param {string} message
   * @param {object...} [parameters]
   */

  /**
   * @function ExecutionRuntime#error
   * @param {string} message
   * @param {object...} [parameters]
   */

  ['debug', 'info', 'warn', 'error'].map(function (level) {
    this[level] = function () {
      log.apply(this, [level].concat(arguments))
    }
  })

  /**
   * Executes method, passing runtime as `this`
   *
   * @param {function} method
   * @param {...object} [args] Additional arguments
   */
  this.execute = function (method, args) {
    return method.apply(this, Array.prototype.slice.call(arguments, 1))
  }

  /**
   * Executes method, passing runtime as `this`
   *
   * @param {function} method
   * @param {...object} [args] Additional arguments
   */
  this.executeAsPromise = function (method, args) {
    if (!(method instanceof Function)) {
      throw new Error('Provided argument is not callable')
    }
    try {
      return Promise.resolve(this.execute.apply(this, arguments))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  /**
   * Allows user-defined functions to trigger transition manually.
   *
   * Monkey-patched later.
   *
   * @function ExecutionRuntime#transitionTo
   *
   * @param {string} id State id
   * @param {object} hints User-defined hints
   */
}

exports = module.exports = {
  ExecutionRuntime: ExecutionRuntime
}
