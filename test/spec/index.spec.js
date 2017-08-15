/* eslint-env mocha */
/* eslint-disable no-global-assign */
/* global Logger, VoxEngine, AppEvents */

var framework = require('../../lib/index')
var chai = require('chai')
var assert = chai.assert

describe('/index.js', function () {
  var scenario = {
    states: [
      {
        id: 'entrypoint',
        entrypoint: true,
        transition: {trigger: 'terminated'}
      },
      {
        id: 'terminated',
        terminal: true
      }
    ],
    trigger: framework.TriggerType.Http
  }
  var _engine = typeof VoxEngine === 'undefined' ? undefined : VoxEngine
  var _logger = typeof Logger === 'undefined' ? undefined : Logger
  var _events = typeof AppEvents === 'undefined' ? undefined : AppEvents

  beforeEach(function () {
    VoxEngine = {
      addEventListener: function (_, listener) {
        listener()
      },
      customData: function () {
        return ''
      }
    }
    Logger = {
      write: function () {}
    }
    AppEvents = {
      Started: function () {}
    }
  })

  afterEach(function () {
    VoxEngine = _engine
    Logger = _logger
    AppEvents = _events
  })

  describe('.run', function () {
    it('should run scenario from index.js without hassle', function () {
      return framework.run(scenario)
    })
  })

  describe('.validate', function () {
    it('should not throw any exception during regular call', function () {
      assert(framework.validate(scenario))
    })
  })
})
