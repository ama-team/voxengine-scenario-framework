/* global AppEvents */

var TriggerType = require('../Schema').TriggerType

/**
 * @implements IEventBinding.<AppEvents.CallAlerting>
 */
var CallAlerting = {
  getEventType: function () {
    return AppEvents.CallAlerting
  },
  getTriggerType: function () {
    return TriggerType.Call
  },
  extractTrigger: function (event) {
    return {
      type: TriggerType.Call,
      event: event,
      call: event.call,
      arguments: event.customData
    }
  }
}

module.exports = {
  CallAlerting: CallAlerting
}
