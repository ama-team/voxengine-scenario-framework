/* eslint-env mocha */

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

var Executor = require('../../../../lib/Execution/Executor').Executor

describe('Unit', function () {
  describe('/Execution', function () {
    describe('/Executor.js', function () {
      describe('.Executor', function () {
        var factory = function (ctx) {
          return new Executor(ctx)
        }

        var callable

        beforeEach(function () {
          callable = Sinon.stub()
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
      })
    })
  })
})
