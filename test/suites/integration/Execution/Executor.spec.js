/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var Executor = require('../../../../lib/Execution/Executor').Executor
var SDK = require('@ama-team/voxengine-sdk')
var CancellationToken = SDK.Concurrent.CancellationToken
var TimeoutException = SDK.Concurrent.TimeoutException

var branchStopper = function () {
  throw new Error('This logical path should not have been taken')
}

describe('Unit', function () {
  describe('/Execution', function () {
    describe('/Executor.js', function () {
      describe('.Executor', function () {
        var factory = function (ctx) {
          return new Executor(ctx)
        }

        var callable
        var context
        var executor

        var autoFactory = function () {
          executor = factory(context)
          return executor
        }

        beforeEach(function () {
          callable = Sinon.stub()
          context = {}
          autoFactory()
        })

        describe('#execute()', function () {
          it('passes context and arguments', function () {
            var ctx = {x: 12}
            var args = [1, 2, 3]
            var result = ['uno', 'duo', 'tres']
            callable.returns(result)
            expect(factory(ctx).execute(callable, args)).to.eq(result)
            expect(callable.callCount).to.eq(1)
            expect(callable.getCall(0).thisValue).to.eq(ctx)
            for (var i = 0; i < args.length; i++) {
              expect(callable.getCall(0).args[i]).to.eq(args[i])
            }
          })

          it('doesn\'t catch errors', function () {
            var error = new Error()
            callable.throws(error)
            var lambda = function () {
              return factory().execute(callable)
            }
            expect(lambda).to.throw(error)
          })
        })

        describe('#promise()', function () {
          it('passes context and arguments', function () {
            var ctx = {x: 12}
            var args = [1, 2, 3]
            var result = ['uno', 'duo', 'tres']
            callable.returns(result)
            return factory(ctx)
              .promise(callable, args)
              .then(function (value) {
                expect(value).to.eq(result)
                expect(callable.callCount).to.eq(1)
                expect(callable.getCall(0).thisValue).to.eq(ctx)
                for (var i = 0; i < args.length; i++) {
                  expect(callable.getCall(0).args[i]).to.eq(args[i])
                }
              })
          })

          it('catches error and rejects promise with it', function () {
            var error = new Error()
            callable.throws(error)
            return factory(null)
              .promise(callable)
              .then(function () {
                throw new Error('This branch should not have been executed')
              }, function (reason) {
                expect(reason).to.eq(error)
              })
          })
        })

        describe('#runHandler()', function () {
          var callable
          var onTimeout
          var onTimeoutTimeout
          var handler

          var autoHandlerFactory = function () {
            handler = {
              id: 'handler',
              handler: callable,
              timeout: null,
              onTimeout: {
                id: 'onHandlerTimeout',
                handler: onTimeout,
                timeout: null,
                onTimeout: {
                  id: 'onOnHandlerTimeoutTimeout',
                  handler: onTimeoutTimeout,
                  timeout: null
                }
              }
            }
            return handler
          }

          beforeEach(function () {
            callable = Sinon.stub().returns(1)
            onTimeout = Sinon.stub().returns(2)
            onTimeoutTimeout = Sinon.stub().returns(3)
            autoHandlerFactory()
          })

          it('performs standard, no-error, no-timeout run', function () {
            var args = [1, 2]
            var result = autoFactory().runHandler(handler, args)
            return result
              .then(function (result) {
                expect(result).to.eq(1)
                expect(callable.callCount).to.eq(1)
                expect(callable.getCall(0).thisValue).to.eq(context)
                for (var i = 0; i < args.length; i++) {
                  expect(callable.getCall(0).args[i]).to.eq(args[i])
                }
                expect(callable.getCall(0).args[args.length]).to.be.instanceOf(CancellationToken)
                expect(onTimeout.callCount).to.eq(0)
              })
          })

          it('delegates work to onTimeout handler in case of timeout', function () {
            var args = [1, 2]
            callable.returns(new Promise(function () {}))
            autoHandlerFactory()
            handler.timeout = 0
            var result = autoFactory().runHandler(handler, args)
            return result
              .then(function (value) {
                expect(value).to.eq(2)
                expect(callable.callCount).to.eq(1)
                expect(onTimeout.callCount).to.eq(1)
                expect(onTimeout.getCall(0).thisValue).to.eq(context)
                for (var i = 0; i < args.length; i++) {
                  expect(onTimeout.getCall(0).args[i]).to.eq(args[i])
                }
                expect(onTimeout.getCall(0).args[args.length]).to.be.instanceOf(CancellationToken)
                expect(onTimeout.getCall(0).args[args.length + 1]).to.be.instanceOf(TimeoutException)
                expect(onTimeoutTimeout.callCount).to.eq(0)
              })
          })

          it('delegates work to onTimeoutTimeout handler in case of multiple timeouts', function () {
            var args = [1, 2]
            callable.returns(new Promise(function () {}))
            onTimeout.returns(new Promise(function () {}))
            autoHandlerFactory()
            handler.timeout = 0
            handler.onTimeout.timeout = 0
            var result = autoFactory().runHandler(handler, args)
            return result
              .then(function (value) {
                expect(value).to.eq(3)
                expect(callable.callCount).to.eq(1)
                expect(onTimeout.callCount).to.eq(1)
                expect(onTimeoutTimeout.callCount).to.eq(1)
                expect(onTimeoutTimeout.getCall(0).thisValue).to.eq(context)
                for (var i = 0; i < args.length; i++) {
                  expect(onTimeoutTimeout.getCall(0).args[i]).to.eq(args[i])
                }
                expect(onTimeoutTimeout.getCall(0).args[args.length]).to.be.instanceOf(CancellationToken)
                expect(onTimeoutTimeout.getCall(0).args[args.length + 1]).to.be.instanceOf(TimeoutException)
                expect(onTimeoutTimeout.getCall(0).args[args.length + 2]).to.be.instanceOf(TimeoutException)
              })
          })

          it('rejects with timeout error if every part of chain times out', function () {
            callable.returns(new Promise(function () {}))
            onTimeout.returns(new Promise(function () {}))
            onTimeoutTimeout.returns(new Promise(function () {}))
            autoHandlerFactory()
            handler.timeout = 0
            handler.onTimeout.timeout = 0
            handler.onTimeout.onTimeout.timeout = 0
            return autoFactory()
              .runHandler(handler)
              .then(branchStopper, function (e) {
                expect(e).to.be.instanceOf(TimeoutException)
              })
          })

          it('cancels token on timeout', function () {
            callable.returns(new Promise(function () {}))
            autoHandlerFactory()
            handler.timeout = 0
            return autoFactory()
              .runHandler(handler)
              .then(function () {
                expect(callable.callCount).to.eq(1)
                var token = callable.getCall(0).args[0]
                expect(token).to.be.instanceOf(CancellationToken)
                expect(token.isCancelled()).to.be.true
              })
          })

          it('creates tokens dependent on passed one', function () {
            callable = Sinon.spy(function (token) {
              // token is a natural thenable
              return token
            })
            autoHandlerFactory()
            var token = new CancellationToken()
            var promise = autoFactory().runHandler(handler, [], token)
            token.cancel()
            return promise
              .then(function () {
                expect(callable.callCount).to.eq(1)
                var token = callable.getCall(0).args[0]
                expect(token).to.be.instanceOf(CancellationToken)
                expect(token.isCancelled()).to.be.true
              })
          })
        })
      })
    })
  })
})
