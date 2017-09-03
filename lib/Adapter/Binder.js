/* global VoxEngine, AppEvents */

var TriggerType = require('../Schema').TriggerType

var Binder = {
  /**
   * @param {Run} run
   */
  bind: function (run) {
    var listener = Binder.startedListener.bind(null, run)
    VoxEngine.addEventListener(AppEvents.Started, listener)
    listener = Binder.callAlertingListener.bind(null, run)
    VoxEngine.addEventListener(AppEvents.CallAlerting, listener)
  },
  /**
   * @param {Run} run
   * @param {AppEvents.Started} event
   */
  startedListener: function (run, event) {
    run.setLog(event.logURL)
    if (run.getScenario().trigger !== TriggerType.Http) {
      return
    }
    var trigger = {
      call: null,
      event: event,
      type: TriggerType.Http,
      arguments: VoxEngine.customData()
    }
    run.proceed(trigger)
  },
  /**
   * @param {Run} run
   * @param {AppEvents.CallAlerting} event
   */
  callAlertingListener: function (run, event) {
    if (run.getScenario().trigger !== TriggerType.Call) {
      return
    }
    var trigger = {
      call: event.call,
      event: event,
      type: TriggerType.Call,
      arguments: event.call.customData
    }
    run.proceed(trigger)
  }
}

module.exports = {
  Binder: Binder
}
