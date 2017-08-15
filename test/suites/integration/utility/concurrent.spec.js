/* eslint-env mocha */

var concurrent = require('../../../../lib/utility/concurrent')
var chai = require('chai')
var assert = chai.assert

chai.should()

describe('/utility', function () {
  describe('/concurrent.js', function () {
    describe('.timeout', function () {
      it('should successfully timeout', function () {
        var promise = concurrent.timeout(new Promise(function () {}), 1)
        return promise.then(function () {
          assert('this branch should have not been executed')
        }, function (rejection) {
          rejection.should.be.instanceof(concurrent.TimeoutException)
        })
      })
    })

    describe('.CompletablePromise', function () {
      it('should resolve externally', function () {
        var promise = new concurrent.CompletablePromise()
        promise.resolve(12)
        return promise.then(function (value) {
          value.should.be.equal(12)
        })
      })

      it('should reject externally', function () {
        var promise = new concurrent.CompletablePromise()
        promise.reject(12)
        return promise.then(function () {
          assert('this branch should have not been executed')
        }, function (value) {
          value.should.be.equal(12)
        })
      })

      it('should resolve once', function () {
        var promise = new concurrent.CompletablePromise()
        promise.resolve(12)
        promise.resolve(42)
        return promise.then(function (value) {
          value.should.be.equal(12)
        })
      })
    })
  })
})
