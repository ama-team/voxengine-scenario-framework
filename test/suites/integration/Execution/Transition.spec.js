/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var SDK = require('@ama-team/voxengine-sdk')
var TimeoutException = SDK.Concurrent.TimeoutException
var Future = SDK.Concurrent.Future

var Transition = require('../../../../lib/Execution/Transition').Transition
var Status = Transition.Status

describe('Integration', function () {
  describe('/Execution', function () {
    describe('/Transition.js', function () {
      describe('.Transition', function () {
        var executor = {
          promise: function (callable, args) {
            try {
              return Promise.resolve(callable.apply(null, args))
            } catch (e) {
              return Promise.reject(e)
            }
          }
        }

        var handlerFactory = function (handler, name, timeout) {
          name = name || 'handler'
          return {
            id: name || 'handler',
            handler: Sinon.spy(handler),
            timeout: typeof timeout === 'number' ? timeout : null,
            timeoutHandler: {
              id: 'timeout' + name[0].toUpperCase() + name.substr(1),
              handler: Sinon.spy(handler),
              timeout: typeof timeout === 'number' ? timeout : null
            }
          }
        }

        var stateFactory = function (handler, timeout, id) {
          handler = handler || function () {
            return Promise.resolve()
          }
          var structure = {
            id: id || 'target-stub',
            timeout: null,
            entrypoint: false,
            terminal: false
          }
          var handlers = ['transition', 'abort']
          handlers.forEach(function (name) {
            structure[name] = handlerFactory(handler, name, timeout)
          })
          return structure
        }

        var factory = function (target, hints, origin) {
          var options = {
            origin: origin || stateFactory(null, null, 'origin-stub'),
            target: target || stateFactory(),
            hints: hints,
            executor: executor
          }
          return new Transition(options)
        }

        describe('< new', function () {
          it('throws error if target state not set', function () {
            expect(function () { return new Transition({}) }).to.throw()
          })

          it('throws error if options are omitted', function () {
            expect(function () { return new Transition() }).to.throw()
          })

          it('throws error if garbage is passed as options', function () {
            expect(function () { return new Transition(false) }).to.throw()
          })
        })

        describe('#run()', function () {
          it('throws on second call', function () {
            var transition = factory()
            transition.run()
            expect(transition.run).to.throw()
          })

          it('ends with Executed status if everything went smoothly', function () {
            var value = {x: 12}
            var target = stateFactory(function () {
              return value
            })
            var transition = factory(target)
            return transition
              .run()
              .then(function (result) {
                expect(result.value).to.eq(value)
                expect(result.status).to.eq(Transition.Status.Executed)
              })
          })

          it('ends with Executed status if timeout handler has rescued situation', function () {
            var value = {x: 12}
            var target = stateFactory()
            var promise = new Promise(function () {})
            target.transition.handler = Sinon.stub().returns(promise)
            target.transition.timeout = 0
            target.transition.timeoutHandler.handler = Sinon.stub().returns(value)
            var transition = factory(target)
            return transition
              .run()
              .then(function (result) {
                expect(target.transition.handler.callCount).to.eq(1)
                expect(target.transition.timeoutHandler.handler.callCount).to.eq(1)
                var token = target.transition.handler.getCall(0).args[2]
                expect(token.isCancelled()).to.be.true
                expect(result.value).to.eq(value)
                expect(result.status).to.eq(Status.Executed)
              })
          })

          it('ends with ExecutionFailure status if everything has timed out', function () {
            var target = stateFactory(function () {
              return new Promise(function () {
              })
            }, 0)
            var transition = factory(target)
            return transition
              .run()
              .then(function (result) {
                expect(result.value).to.be.instanceOf(TimeoutException)
                expect(result.status).to.eq(Status.ExecutionFailure)
              })
          })

          it('passes hints to handler', function () {
            var target = stateFactory()
            var hints = {x: 12}
            var transition = factory(target, hints)
            return transition
                .run()
                .then(function () {
                  var arg = target.transition.handler.getCall(0).args[1]
                  expect(arg).to.eq(hints)
                })
          })
        })

        describe('#abort()', function () {
          it('throws if transition is not started', function () {
            var transition = factory()
            expect(transition.abort).to.throw()
          })

          it('throws if transition has already finished', function () {
            var transition = factory()
            return transition
              .run()
              .then(function () {
                expect(transition.abort).to.throw()
              })
          })

          it('ends with Aborted status if has been aborted before completion', function () {
            var value = {x: 12}
            var target = stateFactory()
            target.transition.handler = function () {
              return new Promise(function () {})
            }
            target.abort.handler = function () {
              return value
            }
            var transition = factory(target)
            transition.run()
            var promise = transition.abort()
            return promise
              .then(function (result) {
                expect(result.value).to.eq(value)
                expect(result.status).to.eq(Status.Aborted)
              })
          })

          it('ends with AbortFailure status if has been aborted before completion and failed it', function () {
            var error = new Error()
            var target = stateFactory()
            var transition = factory(target)
            target.transition.handler = function () {
              return new Promise(function () {})
            }
            target.abort.handler = function () {
              throw error
            }
            transition.run()
            var promise = transition.abort()
            return promise
              .then(function (result) {
                expect(result.value).to.eq(error)
                expect(result.status).to.eq(Status.AbortFailure)
              })
          })

          it('ends with AbortFailure if abort handlers timed out', function () {
            var handler = function () {
              return new Promise(function () {})
            }
            var target = stateFactory(handler, 0)
            target.transition.timeout = null
            var transition = factory(target)
            transition.run()
            var promise = transition.abort()
            return promise
              .then(function (result) {
                expect(result.value).to.be.instanceOf(TimeoutException)
                expect(result.status).to.eq(Status.AbortFailure)
              })
          })

          it('prevents transition from completing', function () {
            var abortValue = {result: 'aborted'}
            var completionValue = {result: 'completed'}
            var abortBarrier = new Future()
            var completionBarrier = new Future()
            var completionHandler = function () {
              return completionBarrier
            }
            var abortHandler = function () {
              return abortBarrier
            }
            var target = stateFactory()
            target.transition.handler = completionHandler
            target.abort.handler = abortHandler
            var transition = factory(target)
            var promise = transition.run()
            expect(transition.getStatus()).to.eq(Status.Executing)
            transition.abort()
            expect(transition.getStatus()).to.eq(Status.Aborting)
            return completionBarrier
              .resolve(completionValue)
              .then(function () {
                abortBarrier.resolve(abortValue)
              })
              .then(function () {
                return promise
              })
              .then(function (result) {
                expect(result.status).to.eq(Status.Aborted)
              })
          })
        })

        describe('#toDetails()', function () {
          it('provides simplified details', function () {
            var target = stateFactory()
            var hints = {x: 12}
            var options = {
              executor: executor,
              target: target,
              origin: null,
              hints: hints
            }
            var transition = new Transition(options)
            var expectation = {
              origin: null,
              target: target.id,
              hints: hints
            }
            expect(transition.toDetails()).to.deep.eq(expectation)
          })
        })

        describe('#launchedAt', function () {
          it('returns null for non-launched transition', function () {
            var transition = factory()
            expect(transition.getLaunchedAt()).to.be.null
          })

          it('returns date for launched transition', function () {
            var transition = factory()
            var lowerBound = new Date()
            return transition
              .run(null, {})
              .then(function () {
                expect(transition.getLaunchedAt()).to.be.at.least(lowerBound)
                expect(transition.getLaunchedAt()).to.be.at.most(new Date())
              })
          })
        })
      })
    })
  })
})
