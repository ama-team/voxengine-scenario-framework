/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

var Initialization = require('../../../../../lib/Execution/Stage/InitializationStage').InitializationStage
var Status = require('../../../../../lib/Schema/OperationStatus').OperationStatus

describe('Unit', function () {
  describe('/Execution', function () {
    describe('/Stage', function () {
      describe('/InitializationStage.js', function () {
        describe('.InitializationStage', function () {
          var context
          var executor
          var deserializer
          var instance

          beforeEach(function () {
            context = {
              arguments: {}
            }
            executor = {
              execute: Sinon.stub(),
              getContext: Sinon.stub().returns(context)
            }
            deserializer = Sinon.stub().returns({})
          })

          var factory = function (executor, deserializer) {
            deserializer = deserializer || function () { return {} }
            return new Initialization(executor, deserializer)
          }

          var autoFactory = function () {
            instance = factory(executor, deserializer)
            return instance
          }

          it('should execute according to expectations', function () {
            var log = 'fake://log'
            var args = {x: 12}
            context.arguments = {z: 13}
            var argExpectation = {x: 12, z: 13}
            var trigger = {arguments: args}
            executor.execute.returns(args)
            autoFactory()
            instance.initialize()
            instance.setLog(log)
            return instance
              .proceed(trigger)
              .then(function (result) {
                expect(result.status).to.eq(Status.Finished)
                expect(result.error).to.be.null
                expect(result.log).to.eq(log)
                expect(executor.execute.callCount).to.eq(1)
                expect(context.arguments).to.deep.eq(argExpectation)
              })
          })

          it('should catch argument deserialization error', function () {
            var error = new Error()
            executor.execute.throws(error)
            var log = 'fake://log'
            autoFactory()
            instance.setLog(log)
            instance.initialize()
            return instance
              .proceed({})
              .then(function (result) {
                expect(result.status).to.eq(Status.Failed)
                expect(result.error).to.eq(error)
                expect(result.log).to.eq(log)
                expect(executor.execute.callCount).to.eq(1)
              })
          })
        })
      })
    })
  })
})
