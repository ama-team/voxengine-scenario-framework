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

var UserSpaceError = factory('UserSpaceError')
var InternalError = factory('InternalError')

module.exports = {
  UserSpaceError: UserSpaceError,
  ScenarioError: factory('ScenarioError', UserSpaceError),
  /**
   * @class InternalError
   */
  InternalError: InternalError,
  /**
   * @class IllegalStateError
   */
  IllegalStateError: factory('IllegalStateError', InternalError)
}
