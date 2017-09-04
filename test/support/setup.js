/* eslint-env mocha */

module.exports = {
  setup: function () {
    require('./Hooks/VoxEngineStubs').setup()
    require('./Hooks/RejectionHandling').setup()
    require('./Hooks/OutputInterception').setup()
    require('./Hooks/SDKLogger').setup()
  }
}
