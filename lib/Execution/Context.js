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
 * @param {Execution} execution
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
function Context (execution, options) {
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
   * @property {objects} args
   */

  /**
   * @deprecated
   * @property {objects} data
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
      logger[method].apply(logger, arguments)
    }
  })

  this.transitionTo = function (id, hints) {
    return execution.transitionTo(id, hints)
  }

  this.getStatus = function () {
    return {
      getRunningTime: execution.getRunningTime,
      getState: execution.getState,
      getTransition: execution.getTransition
    }
  }
}

module.exports = {
  Context: Context
}
