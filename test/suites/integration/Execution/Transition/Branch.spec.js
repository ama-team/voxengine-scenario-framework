/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var SDK = require('@ama-team/voxengine-sdk')
var Concurrent = SDK.Concurrent
var CancellationToken = Concurrent.CancellationToken
var TimeoutException = Concurrent.TimeoutException
var ExecutionBranch = require('../../../../../lib/Execution/Transition/Branch').Branch

function branchStopper () {
  throw new Error('This branch should not have executed')
}

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

          var optionsFactory = function (handler, onTimeout, name) {
            handler = handler || function () {
              return new Promise(function () {})
            }
            onTimeout = onTimeout || function (a, b, c, error) {
              return Promise.reject(error)
            }
            return {
              name: name || 'integration test',
              handler: {
                id: 'handler',
                handler: Sinon.spy(handler),
                timeout: null,
                onTimeout: {
                  id: 'timeoutHandler',
                  handler: Sinon.spy(onTimeout),
                  timeout: null
                }
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
                  expect(options.handler.onTimeout.handler.callCount).to.eq(0)
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
                  expect(options.handler.onTimeout.handler.callCount).to.eq(1)
                })
            })

            it('runs and rejects with main handler rejection reason', function () {
              var reason = new Error()
              var options = optionsFactory(function () {
                return Promise.reject(reason)
              })
              var branch = factory(options)
              return expect(branch.run()).to.eventually.be.rejectedWith(reason)
            })

            it('runs and rejects with timeout rejection reason if main handler times out', function () {
              var reason = new Error()
              var options = optionsFactory(null, function () {
                return Promise.reject(reason)
              })
              options.handler.timeout = 0
              var branch = factory(options)
              return expect(branch.run()).to.eventually.be.rejectedWith(reason)
            })

            it('throws if called more than once', function () {
              var options = optionsFactory(function () {
                return Promise.resolve()
              })
              var branch = factory(options)
              return branch
                .run()
                .then(function () {
                  expect(branch.run).to.throw()
                })
            })

            it('rejects with TimeoutException if both handlers time out', function () {
              var handler = function () {
                return new Promise(function () {})
              }
              var options = optionsFactory(handler, handler)
              options.handler.timeout = 0
              options.handler.onTimeout.timeout = 0
              var branch = factory(options)
              return expect(branch.run()).to.eventually.be.rejectedWith(TimeoutException)
            })

            it('cancels tokens on timeouts', function () {
              var handler = function () {
                return new Promise(function () {})
              }
              var options = optionsFactory(handler, handler)
              var sources = [options.handler, options.handler.onTimeout]
              sources.forEach(function (source) {
                source.timeout = 0
              })
              var branch = factory(options)
              return branch
                .run()
                .then(branchStopper, function () {
                  var handlers = sources.map(function (source) {
                    return source.handler
                  })
                  handlers.forEach(function (handler) {
                    expect(handler.callCount).to.eq(1)
                    var token = handler.getCall(0).args[2]
                    expect(token).to.be.instanceOf(CancellationToken)
                    expect(token.isCancelled()).to.be.true
                  })
                })
            })

            var variants = [
              {
                name: 'handler',
                handler: function () {
                  return Promise.resolve()
                },
                timeout: null
              },
              {
                name: 'timeoutHandler',
                handler: function () {
                  return new Promise(function () {})
                },
                timeout: 0
              }
            ]

            variants.forEach(function (variant) {
              it('creates derived cancellation token for ' + variant.name, function () {
                var options = optionsFactory(variant.handler, function () {
                  return Promise.resolve()
                })
                var token = new CancellationToken()
                options.handler.timeout = variant.timeout
                var branch = factory(options)
                return branch
                  .run(null, null, token)
                  .then(function () {
                    var source = options.handler
                    source = variant.name === 'handler' ? source : source.onTimeout
                    var handler = source.handler
                    expect(handler.callCount).to.eq(1)
                    var passedToken = handler.getCall(0).args[2]
                    expect(passedToken).to.be.instanceOf(CancellationToken)
                    expect(passedToken.isCancelled()).to.be.false
                    token.cancel()
                    return passedToken
                  })
              })
            })
          })
        })
      })
    })
  })
})
