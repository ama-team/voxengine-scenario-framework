/* eslint-env mocha */
/* global allure */

var Yaml = require('js-yaml')

var rejections = []
var handler

beforeEach(function () {
  if (handler) {
    process.removeListener('unhandledRejection', handler)
  }
  handler = function (reason) {
    rejections.push(reason)
    console.warn('UnhandledPromiseRejectionWarning: ' + reason)
  }
  process.on('unhandledRejection', handler)
})

afterEach(function () {
  var staged = rejections
  rejections = []
  if (staged.length === 0) {
    return
  }
  allure._allure.getCurrentTest().status = 'pending'
  for (var index = 0; index < staged.length; index++) {
    var name = 'rejection-' + index + '.yml'
    var reason = staged[index]
    if (reason instanceof Error) {
      reason = {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      }
    }
    var content = Yaml.safeDump(reason)
    global.allure.createAttachment(name, content, 'application/x-yaml')
  }
  // TODO: return strict rejections tracking (throwing error in case of caught
  // unhandled rejection) once it is why it happens only in instrumented code
  // https://github.com/gotwarlost/istanbul/issues/834
})
