/**
 * @class
 *
 * @implements {IExecutor}
 *
 * @param {IExecutionContext} ctx
 */
function Executor (ctx) {
  var self = this

  /**
   * @inheritDoc
   */
  this.execute = function (fn, args) {
    return fn.apply(ctx, args)
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

  this.getContext = function () {
    return ctx
  }
}

module.exports = {
  Executor: Executor
}
