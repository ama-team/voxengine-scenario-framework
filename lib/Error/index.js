var factory = function (name, parent) {
  parent = parent || Error
  var error = function (message) {
    this.message = message
    this.stack = (new Error()).stack
  }
  Object.defineProperty(error, 'name', { value: name })
  error.prototype = Object.create(parent.prototype)
  error.prototype.name = name
  error.prototype.constructor = error
  return error
}

var UserError = factory('UserError')
var InternalError = factory('InternalError')

module.exports = {
  UserError: UserError,
  ScenarioError: factory('ScenarioError', UserError),
  /**
   * @class InternalError
   */
  InternalError: InternalError,
  /**
   * @class IllegalStateError
   */
  IllegalStateError: factory('IllegalStateError', InternalError)
}
