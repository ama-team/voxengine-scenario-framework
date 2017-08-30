/* global VoxEngine, AppEvents */

var TriggerType = require('../Schema').TriggerType

/**
 * @implements IEventBinding.<AppEvents.Started>
 */
var Started = {
  getEventType: function () {
    return AppEvents.Started
  },
  getTriggerType: function () {
    return TriggerType.Http
  },
  extractTrigger: function (event) {
    return {
      type: TriggerType.Http,
      event: event,
      call: null,
      arguments: VoxEngine.customData()
    }
  }
}

module.exports = {
  Started: Started
}
