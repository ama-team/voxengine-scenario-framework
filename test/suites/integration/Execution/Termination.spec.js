/* eslint-env mocha */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var SDK = require('@ama-team/voxengine-sdk')
var TimeoutException = SDK.Concurrent.TimeoutException

var Executor = require('../../../../lib/Execution/Executor').Executor
var Termination = require('../../../../lib/Execution/Termination').Termination
var OperationStatus = require('../../../../lib/Schema/OperationStatus').OperationStatus
var Errors = require('../../../../lib/Error')

describe('Unit', function () {
  describe('/Execution', function () {
    describe('/Termination.js', function () {
      describe('.Termination', function () {
        describe('#run()', function () {
          var handler
          var timeoutHandler
          var handlerStructure
          var executor
          var timeout
          var loggerOptions

          beforeEach(function () {
            executor = new Executor(null)
            handler = function () {}
            timeoutHandler = function () {}
            timeout = null
            loggerOptions = {}
          })

          var autoHandlerFactory = function () {
            handlerStructure = {
              id: 'termination',
              handler: Sinon.spy(handler),
              timeout: timeout,
              timeoutHandler: {
                id: 'terminationTimeout',
                handler: Sinon.spy(timeoutHandler),
                timeout: timeout
              }
            }
            return handlerStructure
          }

          var autoFactory = function () {
            return new Termination(executor, autoHandlerFactory(), loggerOptions)
          }

          it('passes argument to provided termination handler', function () {
            var termination = autoFactory()
            var argument = {x: 12}
            return termination
              .run(argument)
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Finished)
                var handler = handlerStructure.handler
                expect(handler.callCount).to.eq(1)
                expect(handler.getCall(0).args[0]).to.eq(argument)
              })
          })

          it('passes control to timeout handler on timeout', function () {
            timeout = 0
            handler = function () {
              return new Promise(function () {})
            }
            var argument = {x: 12}
            var termination = autoFactory()
            return termination
              .run(argument)
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Finished)
                var handler = handlerStructure.timeoutHandler.handler
                expect(handler.callCount).to.eq(1)
                expect(handler.getCall(0).args[0]).to.eq(argument)
                expect(handler.getCall(0).args[1]).to.be.instanceOf(TimeoutException)
              })
          })

          it('timeouts timeout handler as well', function () {
            timeout = 0
            handler = timeoutHandler = function () {
              return new Promise(function () {})
            }
            var termination = autoFactory()
            return termination
              .run()
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Failed)
                expect(result.value).to.be.instanceOf(TimeoutException)
                var handlers = [
                  handlerStructure.handler,
                  handlerStructure.timeoutHandler.handler
                ]
                handlers.forEach(function (handler) {
                  expect(handler.callCount).to.eq(1)
                })
              })
          })

          it('catches handler error', function () {
            var error = new Error()
            handler = function () { return Promise.reject(error) }
            var termination = autoFactory()
            return termination
              .run()
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Failed)
                expect(result.value).to.eq(error)
              })
          })

          it('catches timeout handler error', function () {
            var error = new Error()
            handler = function () {
              return new Promise(function () {})
            }
            timeoutHandler = function () {
              throw error
            }
            timeout = 0
            var termination = autoFactory()
            return termination
              .run()
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Failed)
                expect(result.value).to.eq(error)
              })
          })

          it('catches framework error', function () {
            var error = new Error()
            executor.promise = Sinon.spy(function () {
              throw error
            })
            var termination = autoFactory()
            return termination
              .run()
              .then(function (result) {
                expect(result.status).to.eq(OperationStatus.Tripped)
                expect(result.value).to.be.instanceOf(Errors.UnexpectedError)
                expect(result.value.parent).to.eq(error)
              })
          })
        })
      })
    })
  })
})
