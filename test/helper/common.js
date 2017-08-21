/* eslint-env mocha */

var slf4j = require('@ama-team/voxengine-sdk').logger.slf4j
var Slf4j = slf4j.Slf4j
var LogLevel = slf4j.Level
var chai = require('chai')
var unhandledPromises

var resolvedFactory = function (v) {
  return function () {
    return Promise.resolve(v)
  }
}

var rejectedFactory = function (e) {
  return function () {
    return Promise.reject(e)
  }
}

// noinspection JSUnusedGlobalSymbols
exports = module.exports = {
  setup: function () {},
  getLogger: function () {
    var name = 'ama-team.voxengine-scenario-framework.test.runtime'
    return Slf4j.create(name, LogLevel.All)
  },
  getUnhandledPromises: function () { return unhandledPromises },
  resolvedFactory: resolvedFactory,
  resolved: resolvedFactory(),
  rejectedFactory: rejectedFactory,
  rejected: rejectedFactory(),
  infinite: function () {
    return new Promise(function () {})
  },
  restrictedBranchHandler: function () {
    chai.assert.fail('this branch should have never been executed')
  }
}
