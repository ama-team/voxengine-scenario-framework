var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j

/**
 * @typedef {object} Context~Options
 *
 * @property {object} [arguments]
 * @property {object} [container]
 * @property {object} [state]
 * @property {LoggerOptions|IVarArgLogger} [logger]
 */

/**
 * This class is used as `this` for user-supplied and framework functions,
 * literally being execution context.
 *
 * @param {Context~Options} [options]
 *
 * @class
 *
 * @property {object} arguments
 * @property {object} state
 * @property {object} container
 */

function Context (options) {
  options = options || {}

  var name = 'ama-team.vsf.execution.context'
  var logger = Slf4j.factory(options.logger, name)
  var self = this

  this.arguments = options.arguments || {}
  this.container = options.container || {}
  this.state = options.state || options.data || {}
  /** @deprecated */
  this.data = this.state
  this.execution = options.execution || null

  Object.keys(logger).forEach(function (method) {
    if (typeof logger[method] !== 'function') { return }
    self[method] = function () {
      logger[method].apply(logger, arguments)
    }
  })

  /**
   * Executes callable in current context, returning result or throwing error.
   *
   * @param {Function} callable
   * @param {*[]} [args] Arguments for callable
   * @return {Thenable.<*>}
   */
  this.execute = function (callable, args) {
    return callable.apply(self, args || [])
  }

  /**
   * Executes callable in current context, returning promise.
   *
   * @param {Function} callable
   * @param {*[]} [args] Arguments for callable
   * @return {Thenable.<*>}
   */
  this.promise = function (callable, args) {
    return new Promise(function (resolve, reject) {
      try {
        resolve(self.execute(callable, args))
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = {
  Context: Context
}
