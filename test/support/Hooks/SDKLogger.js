/* eslint-env mocha */

var SDK = require('@ama-team/voxengine-sdk')

module.exports = {
  setup: function () {
    beforeEach(function () {
      SDK.Logger.Slf4j.setWriter(global.Logger)
      SDK.Logger.Slf4j.setLevel(SDK.Logger.Level.All)
    })
  }
}
