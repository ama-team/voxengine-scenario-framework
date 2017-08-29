/* eslint-env mocha */

var Chai = require('chai')
var expect = Chai.expect

var Normalizer = require('../../../../lib/Schema/Normalizer').Normalizer

describe('Unit', function () {
  describe('/Schema', function () {
    describe('/Normalizer.js', function () {
      describe('.Normalizer', function () {
        describe('.handler()', function () {
          var id = 'handler'
          var onTimeoutId = 'onHandlerTimeout'

          it('doesn\'t touch already prepared structure', function () {
            var handler = {
              id: id,
              timeout: 10,
              handler: function () {},
              onTimeout: {
                id: onTimeoutId,
                handler: function () {},
                timeout: 10
              }
            }

            expect(Normalizer.stateHandler(handler, handler.id, {})).to.equal(handler)
          })

          it('creates timeout handler', function () {
            var handler = {
              id: id,
              handler: function () {},
              timeout: 10
            }

            var result = Normalizer.stateHandler(handler, handler.id, {})
            expect(result).to.have.property('onTimeout')
            var onTimeout = result.onTimeout
            expect(onTimeout).to.have.property('id').eq('onHandlerTimeout')
            expect(onTimeout).to.have.property('handler').instanceOf(Function)
            expect(onTimeout).to.have.property('timeout')
            expect(onTimeout).not.to.have.property('onTimeout')
          })

          it('automatically fills id', function () {
            var handler = {
              handler: function () {}
            }

            var result = Normalizer.stateHandler(handler, id, {})
            expect(result).to.have.property('id').eq(id)
          })

          it('automatically fills timeouts', function () {
            var timeouts = {}
            var timeout = 10
            timeouts[id] = timeout
            timeouts[onTimeoutId] = timeout
            var handler ={
              id: id,
              handler: function () {}
            }

            var result = Normalizer.stateHandler(handler, id, timeouts)
            expect(result).to.have.property('timeout').eq(timeout)
            expect(result).to.have.property('onTimeout')
            var onTimeout = result.onTimeout
            expect(onTimeout).to.have.property('timeout').eq(timeout)
          })

          it('recognizes function input', function () {
            var input = function () {}

            var result = Normalizer.stateHandler(input, id, {})
            expect(result).to.have.property('handler').equal(input)
          })

          it('wraps non-function value', function () {
            var value = {x: 12}
            var input = {handler: value}

            var result = Normalizer.stateHandler(input, id, {})
            expect(result).to.have.property('handler').instanceOf(Function)
            expect(result.handler()).to.equal(value)
          })
        })
      })
    })
  })
})
