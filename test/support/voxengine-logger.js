/* eslint-env mocha */
/* global allure */

function FakeLogger () {
  var logs = []
  this.write = logs.push.bind(logs)
  this.flush = function () {
    if (logs.length === 0) {
      return
    }
    allure.createAttachment('voxengine.log', logs.join('\r\n'), 'text/plain')
    logs = []
  }
}

var logger = new FakeLogger()

global.Logger = {
  write: function (message) {
    logger.write(message)
  }
}

var SDK = require('@ama-team/voxengine-sdk')

beforeEach(function () {
  SDK.Logger.Slf4j.setLevel(SDK.Logger.Level.All)
  logger = new FakeLogger()
})

afterEach(function () {
  logger.flush()
})
