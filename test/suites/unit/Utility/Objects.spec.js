/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

var Objects = require('../../../../lib/Utility/Objects').Objects

describe('Unit', function () {
  describe('/Utility', function () {
    describe('/Objects.js', function () {
      describe('.Objects', function () {
        var primitives = {
          null: null,
          undefined: undefined,
          integer: 0,
          float: 0.1,
          boolean: true
        }

        describe('.isObject()', function () {
          Object.keys(primitives).forEach(function (key) {
            it('returns false for ' + key, function () {
              var value = primitives[key]
              expect(Objects.isObject(value)).to.be.false
            })
          })

          it('returns false for function', function () {
            expect(Objects.isObject(function () {})).to.be.false
          })

          it('returns true for plain object', function () {
            expect(Objects.isObject({})).to.be.true
          })
        })

        describe('.merge()', function () {
          it('doesn\'t perform deep merge unless asked', function () {
            var marker = {x: 12}
            var source = {value: marker}
            var result = Objects.merge({value: {z: 13}}, source)
            var expectation = {value: {x: 12}}

            expect(result).to.deep.eq(expectation)
            expect(result.value).to.equal(marker)
          })

          it('doesn\'t merge arrays', function () {
            expect(Objects.merge([1], [2])).to.deep.eq([2])
          })

          it('performs deep merges when asked', function () {
            var target = {x: {y: 12, z: 13}, y: 12}
            var source = {x: {x: 34, z: 36}}
            var expectation = {x: {x: 34, y: 12, z: 36}, y: 12}
            expect(Objects.merge(target, source, true)).to.deep.eq(expectation)
          })
        })

        describe('.copy()', function () {
          Object.keys(primitives).forEach(function (key) {
            it('returns ' + key + ' directly', function () {
              var value = primitives[key]
              expect(Objects.copy(value)).to.equal(value)
            })
          })

          it('copies object properties', function () {
            var source = {value: {x: 12}}
            var copy = Objects.copy(source)
            expect(copy).to.deep.eq(source)
            expect(copy).not.to.equal(source)
            expect(copy.value).to.equal(source.value)
          })

          it('recursively copies object properties if deep copy is requested', function () {
            var source = {value: {x: 12}}
            var copy = Objects.copy(source, true)
            expect(copy).to.deep.eq(source)
            expect(copy).not.to.equal(source)
            expect(copy.value).not.to.equal(source.value)
          })
        })

        describe('.isFunction()', function () {
          it('returns true for function', function () {
            expect(Objects.isFunction(function () {})).to.be.true
          })

          Object.keys(primitives).forEach(function (key) {
            it('returns false for ' + key, function () {
              expect(Objects.isFunction(primitives[key])).to.be.false
            })
          })
        })
      })
    })
  })
})
