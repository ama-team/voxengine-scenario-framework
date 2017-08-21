/* eslint-env mocha */

var Context = require('../../../../lib/Execution/Context').Context

var Sinon = require('sinon')
var Chai = require('chai')
var expect = Chai.expect

Chai.use(require('chai-as-promised'))

describe('Unit', function () {
  describe('/Execution', function () {
    describe('/Context.js', function () {
      describe('.Context', function () {
        describe('< new', function () {
          it('tolerates missing settings', function () {
            var lambda = function () { return new Context() }
            expect(lambda).not.to.throw()
          })

          it('tolerates invalid settings', function () {
            var lambda = function () { return new Context('test') }
            expect(lambda).not.to.throw()
          })
        })

        describe('#execute()', function () {
          it('executes callable with same arguments, passing context as this and returning result', function () {
            var value = {x: 12}
            var stub = Sinon.stub().returns(value)
            var args = [1, 2]
            var context = new Context()

            expect(context.execute(stub, args)).to.eq(value)
            expect(stub.callCount).to.eq(1)
            var call = stub.getCall(0)
            expect(call.thisValue).to.eq(context)
            for (var i = 0; i < args.length; i++) {
              expect(call.args[i]).to.eq(args[i])
            }
          })

          it('executes callable with empty arguments list if none supplied', function () {
            var stub = Sinon.stub()
            var context = new Context()

            context.execute(stub)
            expect(stub.callCount).to.eq(1)
            expect(stub.getCall(0).args).to.be.empty
          })

          it('doesn\'t suppress error', function () {
            var error = new Error()
            var stub = Sinon.stub().throws(error)
            var lambda = function () {
              return new Context().execute(stub)
            }

            expect(lambda).to.throw(error)
          })
        })

        describe('#promise()', function () {
          it('wraps execution result in resolved promise', function () {
            var value = {x: 12}
            var stub = Sinon.stub().returns(value)

            var promise = new Context().promise(stub);
            return expect(promise).to.eventually.equal(value)
          })

          it('wraps execution error in rejected promise', function () {
            var error = new Error()
            var stub = Sinon.stub().throws(error)

            var promise = new Context().promise(stub);
            return expect(promise).to.eventually.be.rejectedWith(error)
          })
        })

        var methods = ['trace', 'debug', 'info', 'notice', 'warn', 'error']
        methods.forEach(function (method) {
          describe('#' + method + '()', function () {
            it('proxies logger method', function () {
              var logger = {}
              var stub = Sinon.stub()
              logger[method] = stub
              var context = new Context({logger: {instance: logger}})
              var args = ['message {} {}', 1, 2]

              context[method].apply(context, args)
              expect(stub.callCount).to.eq(1)
              expect(stub.getCall(0).args).to.deep.eq(args)
              expect(stub.getCall(0).thisValue).to.eq(logger)
            })
          })
        })
      })
    })
  })
})
