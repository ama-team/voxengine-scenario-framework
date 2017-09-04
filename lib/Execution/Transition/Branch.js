var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var Future = SDK.Concurrent.Future
var Errors = require('../../Error')

/**
 * @typedef {object} Branch~Options
 *
 * @property {String} name
 * @property {TStateHandler} handler
 * @property {LoggerOptions} logger
 * @property {IExecutor} executor
 */

/**
 * Represents single transition execution branch (main / abort). It's
 * entrypoint, #run() method, triggers it's execution and returns a promise
 * that either resolves with whatever handler returns or rejects with error.
 *
 * @param {Branch~Options} options
 * @class
 */
function Branch (options) {
  var result = new Future()
  var triggered = false
  var loggerName = 'ama-team.vsf.execution.transition.branch'
  var logger = Slf4j.factory(options.logger, loggerName)
  logger.attach('name', options.name)

  function run (origin, hints, token) {
    if (triggered) {
      var message = 'Tried to run execution branch ' + options.name + ' twice'
      throw new Errors.IllegalStateError(message)
    }
    triggered = true
    logger.debug('Launched')
    options.executor.runHandler(options.handler, [origin, hints], token)
      .then(function (value) {
        logger.debug('Execution branch has finished with {}', value)
        result.resolve(value)
      }, function (reason) {
        logger.debug('Execution branch has failed with reason {}', reason)
        result.reject(reason)
      })
    return result
  }

  /**
   * Runs execution branch.
   *
   * @param {TState} origin
   * @param {THints} hints
   * @param {CancellationToken} [token]
   *
   * @return {Thenable}
   */
  this.run = run
}

module.exports = {
  Branch: Branch
}
