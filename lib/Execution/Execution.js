/**
 * @class
 *
 * @implements {IExecutionStatus}
 *
 * @property {Date|null} launchedAt
 * @property {StateMachine|null} machine
 */
function Execution () {
  var self = this

  this.launchedAt = null
  this.machine = null

  this.getRunningTime = function () {
    var time = self.launchedAt ? self.launchedAt.getTime() : null
    return time ? (new Date().getTime()) - time : null
  }

  this.getState = function () {
    var state = self.machine && self.machine.getState()
    return state ? state.id : null
  }

  this.getTransition = function () {
    var t8n = self.machine && self.machine.getTransition()
    return t8n ? t8n.toDetails() : null
  }
}

module.exports = {
  Execution: Execution
}
