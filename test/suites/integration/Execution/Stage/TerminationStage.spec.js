/* eslint-env mocha */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var SDK = require('@ama-team/voxengine-sdk')
var TimeoutException = SDK.Concurrent.TimeoutException

var Executor = require('../../../../../lib/Execution/Executor').Executor
var Termination = require('../../../../../lib/Execution/Stage/TerminationStage').TerminationStage
var OperationStatus = require('../../../../../lib/Schema/OperationStatus').OperationStatus

describe('Unit', function () {
  describe('/Execution', function () {
    describe('/Stage', function () {
      describe('/TerminationStage.js', function () {
        describe('.TerminationStage', function () {
          describe('#run()', function () {
            var handler
            var onTimeout
            var handlerStructure
            var executor
            var timeout
            var loggerOptions

            beforeEach(function () {
              executor = new Executor(null)
              handler = function () {}
              onTimeout = function () {}
              timeout = null
              loggerOptions = {}
            })

            var autoHandlerFactory = function () {
              handlerStructure = {
                id: 'termination',
                handler: Sinon.spy(handler),
                timeout: timeout,
                onTimeout: {
                  id: 'terminationTimeout',
                  handler: Sinon.spy(onTimeout),
                  timeout: timeout
                }
              }
              return handlerStructure
            }

            var autoFactory = function () {
              return new Termination(executor, autoHandlerFactory(), loggerOptions)
            }

            it('tolerates missing options', function () {
              var lambda = function () {
                return new Termination(executor, autoHandlerFactory())
              }
              expect(lambda).not.to.throw()
            })

            it('passes argument to provided termination handler', function () {
              var termination = autoFactory()
              var argumentA = {x: 12}
              var argumentB = {y: 13}
              return termination
                .run(argumentA, argumentB)
                .then(function (result) {
                  expect(result.status).to.eq(OperationStatus.Finished)
                  var handler = handlerStructure.handler
                  expect(handler.callCount).to.eq(1)
                  expect(handler.getCall(0).args[0]).to.eq(argumentA)
                  expect(handler.getCall(0).args[1]).to.eq(argumentB)
                })
            })

            it('passes control to timeout handler on timeout', function () {
              timeout = 0
              handler = function () {
                return new Promise(function () {})
              }
              var argumentA = {x: 12}
              var argumentB = {y: 13}
              var termination = autoFactory()
              return termination
                .run(argumentA, argumentB)
                .then(function (result) {
                  expect(result.status).to.eq(OperationStatus.Finished)
                  var handler = handlerStructure.onTimeout.handler
                  expect(handler.callCount).to.eq(1)
                  expect(handler.getCall(0).args[0]).to.eq(argumentA)
                  expect(handler.getCall(0).args[1]).to.eq(argumentB)
                  expect(handler.getCall(0).args[3]).to.be.instanceOf(TimeoutException)
                })
            })

            it('timeouts timeout handler as well', function () {
              timeout = 0
              handler = onTimeout = function () {
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
                    handlerStructure.onTimeout.handler
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
              onTimeout = function () {
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
          })
        })
      })
    })
  })
})
