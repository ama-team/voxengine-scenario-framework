/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

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
            var lambda = function () { return new Context({}) }
            expect(lambda).not.to.throw()
          })

          it('tolerates invalid settings', function () {
            var lambda = function () { return new Context({}, 'test') }
            expect(lambda).not.to.throw()
          })

          it('doesn\'t inherit logger properties', function () {
            var options = {
              logger: {
                instance: {
                  key: 'value',
                  info: function () {}
                }
              }
            }
            var context = new Context({}, options)
            expect(context).not.to.have.property('key')
            expect(context).to.have.property('info').instanceOf(Function)
          })
        })

        var methods = ['trace', 'debug', 'info', 'notice', 'warn', 'error']
        methods.forEach(function (method) {
          describe('#' + method + '()', function () {
            it('proxies logger method', function () {
              var logger = {}
              var stub = Sinon.stub()
              logger[method] = stub
              var context = new Context({}, {logger: {instance: logger}})
              var args = ['message {} {}', 1, 2]

              context[method].apply(context, args)
              expect(stub.callCount).to.eq(1)
              expect(stub.getCall(0).args).to.deep.eq(args)
              expect(stub.getCall(0).thisValue).to.eq(logger)
            })
          })
        })

        describe('#transitionTo()', function () {
          it('passes call to execution machine object', function () {
            var result = {x: 12}
            var handler = Sinon.stub().returns(result)
            var execution = {
              machine: {
                transitionTo: handler
              }
            }
            var id = 'id'
            var hints = {hints: null}
            var context = new Context(execution)

            expect(context.transitionTo(id, hints)).to.eq(result)
            expect(handler.callCount).to.eq(1)
            expect(handler.getCall(0).args[0]).to.eq(id)
            expect(handler.getCall(0).args[1]).to.eq(hints)
          })
        })

        describe('#getStatus()', function () {
          it('creates object with execution delegates', function () {
            var execution = {
              getRunningTime: Sinon.stub(),
              getState: Sinon.stub(),
              getTransition: Sinon.stub()
            }
            var context = new Context(execution)
            var status = context.getStatus()

            Object.keys(execution).forEach(function (key) {
              status[key]()
              expect(execution[key].callCount).to.eq(1)
            })
          })
        })

        var deprecatedProperties = {args: 'arguments', data: 'state'}
        Object.keys(deprecatedProperties).forEach(function (property) {
          describe('#' + property, function () {
            var target = deprecatedProperties[property]
            it('provides `' + property + '` as proxy for `' + target, function () {
              var value = {x: 12}
              var context = new Context({})
              expect(context[property]).to.deep.eq({})
              context[target] = value
              expect(context[property]).to.equal(value)
            })
          })
        })
      })
    })
  })
})
