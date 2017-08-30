/**
 * @enum
 * @readonly
 */
var TriggerType = {
  Http: 'Http',
  Call: 'Call'
}

TriggerType.find = function (trigger) {
  trigger = trigger && trigger.toLowerCase()
  return Object.keys(TriggerType).reduce(function (carrier, key) {
    return key.toLowerCase() === trigger ? TriggerType[key] : carrier
  }, null)
}

module.exports = {
  TriggerType: TriggerType
}
