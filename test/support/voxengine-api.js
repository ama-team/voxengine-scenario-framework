/* eslint-env mocha */
/* eslint-disable no-global-assign */
/* global VoxEngine, Logger, AppEvents */

var _engine = typeof VoxEngine === 'undefined' ? undefined : VoxEngine
var _logger = typeof Logger === 'undefined' ? undefined : Logger
var _events = typeof AppEvents === 'undefined' ? undefined : AppEvents

beforeEach(function () {
  global.VoxEngine = {
    terminate: function () {},
    addEventListener: function (_, listener) {
      listener()
    },
    customData: function () {
      return ''
    }
  }
  global.Logger = {
    write: function () {}
  }
  global.AppEvents = {
    Started: function () {}
  }
})

afterEach(function () {
  global.VoxEngine = _engine
  global.Logger = _logger
  global.AppEvents = _events
})
