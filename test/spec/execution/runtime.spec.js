var sinon = require('sinon'),
    chai = require('chai'),
    assert = chai.assert,
    ExecutionRuntime = require('../../../lib/execution/runtime').ExecutionRuntime;

describe('/execution', function () {
    describe('/runtime.js', function () {
        it('should correctly execute method in context of runtime', function () {
            var method = sinon.spy(function () { return this; }),
                arg1 = 'where',
                arg2 = 'is',
                arg3 = 'my',
                arg4 = 'pig',
                runtime = new ExecutionRuntime({}),
                result = runtime.execute(method, arg1, arg2, arg3, arg4);

            assert.equal(result, runtime);
            assert.equal(method.getCall(0).args[0], arg1);
            assert.equal(method.getCall(0).args[1], arg2);
            assert.equal(method.getCall(0).args[2], arg3);
            assert.equal(method.getCall(0).args[3], arg4);
        });
    });
});