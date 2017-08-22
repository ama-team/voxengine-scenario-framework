/* eslint-env mocha */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var ExecutionBranch = require('../../../../../lib/Execution/Transition/Branch').Branch

describe('Integration', function () {
  describe('/Execution', function () {
    describe('/Transition', function () {
      describe('/Branch.js', function () {
        describe('.Branch', function () {
          var executor = {
            promise: function (callable, args) {
              try {
                return Promise.resolve(callable.apply(null, args))
              } catch (e) {
                return Promise.reject(e)
              }
            }
          }

          var optionsFactory = function (handler, timeoutHandler, name) {
            handler = handler || function () {
              return new Promise(function () {})
            }
            timeoutHandler = timeoutHandler || function (a, b, c, error) {
              return Promise.reject(error)
            }
            return {
              name: name || 'integration test',
              handler: {
                name: 'handler',
                handler: Sinon.spy(handler),
                timeout: null
              },
              timeoutHandler: {
                name: 'timeoutHandler',
                handler: Sinon.spy(timeoutHandler),
                timeout: null
              },
              executor: executor,
              logger: {}
            }
          }

          var factory = function (options) {
            return new ExecutionBranch(options)
          }

          describe('#run', function () {
            it('returns handler result ', function () {
              var value = {x: 12}
              var options = optionsFactory(function () {
                return Promise.resolve(value)
              })
              var branch = factory(options)
              return expect(branch.run()).to.eventually.eq(value)
            })

            it('doesn\'t run timeout handler if main handler executes correctly', function () {
              var value = {x: 12}
              var options = optionsFactory(function () {
                return Promise.resolve(value)
              })
              var branch = factory(options)
              return branch
                .run()
                .then(function () {
                  expect(options.handler.handler.callCount).to.eq(1)
                  expect(options.timeoutHandler.handler.callCount).to.eq(0)
                })
            })

            it('runs and returns timeout handler result if main handler times out', function () {
              var value = {x: 12}
              var options = optionsFactory(null, function () {
                return Promise.resolve(value)
              })
              options.handler.timeout = 0
              var branch = factory(options)
              return branch
                .run()
                .then(function (result) {
                  expect(result).to.eq(value)
                  expect(options.handler.handler.callCount).to.eq(1)
                  expect(options.timeoutHandler.handler.callCount).to.eq(1)
                })
            })
          })
        })
      })
    })
  })
})
