/* eslint-env mocha */

var rejections = []
var handler

beforeEach(function () {
  handler = function (reason) {
    rejections.push(reason)
  }
  process.on('unhandledRejection', handler)
})

afterEach(function () {
  process.removeListener('unhandledRejection', handler)
  var staged = rejections
  rejections = []
  if (staged.length === 0) {
    return
  }
  var lines = staged.map(function (rejection) {
    return '- ' + rejection
  })
  lines.unshift('Unhandled rejections have been caught during test execution:')
  throw new Error(lines.join('\r\n'))
})
