/* eslint-env mocha */

var sinon = require('sinon')
var chai = require('chai')
var assert = chai.assert
var ExecutionRuntime = require('../../../lib/execution/runtime').ExecutionRuntime

describe('/execution', function () {
  describe('/runtime.js', function () {
    it('should correctly execute method in context of runtime', function () {
      var method = sinon.spy(function () { return this })
      var arg1 = 'where'
      var arg2 = 'is'
      var arg3 = 'my'
      var arg4 = 'pig'
      var runtime = new ExecutionRuntime({})
      var result = runtime.execute(method, arg1, arg2, arg3, arg4)

      assert.equal(result, runtime)
      assert.equal(method.getCall(0).args[0], arg1)
      assert.equal(method.getCall(0).args[1], arg2)
      assert.equal(method.getCall(0).args[2], arg3)
      assert.equal(method.getCall(0).args[3], arg4)
    })
  })
})
