/**
 * @class
 *
 * @implements {IExecutor}
 *
 * @param {IExecutionContext} ctx
 */
function Executor (ctx) {
  var self = this

  this.execute = function (fn, args) {
    return fn.apply(ctx, args)
  }

  this.promise = function (fn, args) {
    try {
      return Promise.resolve(self.execute(fn, args))
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

module.exports = {
  Executor: Executor
}
