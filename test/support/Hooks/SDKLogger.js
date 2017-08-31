/* eslint-env mocha */

var SDK = require('@ama-team/voxengine-sdk')

beforeEach(function () {
  SDK.Logger.Slf4j.setLevel(SDK.Logger.Level.All)
})
