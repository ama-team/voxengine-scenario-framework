var SDK = require('@ama-team/voxengine-sdk')
var TimeoutException = SDK.Concurrent.TimeoutException
var timeout = SDK.Concurrent.timeout
var CancellationToken = SDK.Concurrent.CancellationToken
var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j
var Objects = require('../Utility').Objects

/**
 * @class
 *
 * @implements {IExecutor}
 *
 * @param {IExecutionContext} ctx
 * @param {object} [options]
 */
function Executor (ctx, options) {
  var self = this
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.execution.executor')

  /**
   * @inheritDoc
   */
  this.execute = function (fn, args) {
    return fn.apply(ctx, args || [])
  }

  /**
   * @inheritDoc
   */
  this.promise = function (fn, args) {
    try {
      return Promise.resolve(self.execute(fn, args))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  /**
   * @param {THandler} handler
   * @param {CancellationToken} [parent]
   */
  function tokenFactory (handler, parent) {
    var deps = parent ? [parent] : []
    return new CancellationToken(deps, 'handler `' + handler.id + '`')
  }

  /**
   * @param {THandler} handler
   * @param {CancellationToken} [token]
   * @param {*[]} [args]
   * @param {number} tokenArg
   * @return {Function}
   */
  function callbackFactory (handler, args, token, tokenArg) {
    return function (resolve, reject) {
      var message = 'Handler `' + handler.id + '` has exceeded it\'s timeout ' +
        'of ' + handler.timeout + ' ms'
      logger.warn(message)
      var error = new TimeoutException(message)
      args[tokenArg].cancel()
      if (!Objects.isObject(handler.onTimeout) || !Objects.isFunction(handler.onTimeout.handler)) {
        return reject(error)
      }
      args = args.slice().concat(error)
      return self
        .runHandler(handler.onTimeout, args, token, tokenArg)
        .then(resolve, function (e) { reject(e) })
    }
  }

  /**
   * @inheritDoc
   */
  this.runHandler = function (handler, args, token, tokenArg) {
    logger.debug('Running handler `{}`', handler.id)
    args = args ? args.slice() : []
    tokenArg = typeof tokenArg === 'number' ? tokenArg : args.length
    args[tokenArg] = tokenFactory(handler, token)
    var promise = self.promise(handler.handler, args)
    if (typeof handler.timeout === 'number' && handler.timeout >= 0) {
      logger.trace('Scheduling handler `{}` timeout in {} ms', handler.id,
        handler.timeout)
      var message = handler.id + ' has exceeded it\'s execution timeout of ' +
        handler.timeout
      var callback = callbackFactory(handler, args, token, tokenArg)
      promise = timeout(promise, handler.timeout, callback, message)
    }
    return promise
  }

  this.getContext = function () {
    return ctx
  }
}

module.exports = {
  Executor: Executor
}
