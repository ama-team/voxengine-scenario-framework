/**
 * @class
 *
 * @property {*} result
 * @property {boolean} success
 * @property {TransitionStatus} status
 * @property {int} duration
 */
function TransitionResult (result, success, status, duration) {
  this.result = result
  this.success = success
  this.status = status
  this.duration = duration
}

TransitionResult.fromError = function (error, status, duration) {
  return new TransitionResult(error, false, status, duration)
}

TransitionResult.fromValue = function (value, status, duration) {
  return new TransitionResult(value, true, status, duration)
}

module.exports = {
  TransitionResult: TransitionResult
}
