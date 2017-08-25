/**
 *
 * @class
 *
 * @implements {IExecutor}
 *
 * @param {object} [context]
 */
function SimpleExecutor (context) {
  context = context || {}
  var self = this

  this.execute = function (callable, args) {
    return callable.apply(context, args || [])
  }

  this.promise = function (callable, args) {
    try {
      return Promise.resolve(self.execute(callable, args))
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

module.exports = {
  SimpleExecutor: SimpleExecutor
}
