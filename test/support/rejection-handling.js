/* eslint-env mocha */

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
  throw new Error(staged.length + ' rejections discovered')
})
