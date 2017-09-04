var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j

/**
 * @typedef {object} Context~Options
 *
 * @property
 * @property {object} [arguments]
 * @property {object} [container]
 * @property {object} [state]
 * @property {LoggerOptions|IVarArgLogger} [logger]
 */

/**
 * This class is used as `this` for user-supplied and framework functions,
 * literally being execution context.
 *
 * @param {Run} run
 * @param {Context~Options} [options]
 *
 * @class
 *
 * @implements IExecutionContext
 *
 * @property {object} arguments
 * @property {object} state
 * @property {object} container
 */
function Context (run, options) {
  options = options || {}

  var name = 'ama-team.vsf.execution.context'
  var logger = Slf4j.factory(options.logger, name)
  var self = this

  this.arguments = options.arguments || options.args || {}
  this.container = options.container || {}
  this.state = options.state || options.data || {}
  this.trigger = null

  /**
   * @deprecated
   * @property {object} args
   */

  /**
   * @deprecated
   * @property {object} data
   */
  Object.defineProperties(this, {
    data: {
      get: function () {
        return self.state
      }
    },
    args: {
      get: function () {
        return self.arguments
      }
    }
  })

  Object.keys(logger).forEach(function (method) {
    if (typeof logger[method] !== 'function') { return }
    self[method] = function () {
      var target = self.logger || logger
      target[method].apply(target, arguments)
    }
  })

  this.transitionTo = function (id, hints) {
    return run.transitionTo(id, hints)
  }
}

module.exports = {
  Context: Context
}
