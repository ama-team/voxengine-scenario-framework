var stateMachineModule = require('../../../lib/execution/state-machine'),
    StateMachine = stateMachineModule.StateMachine,
    ExecutionRuntime = require('../../../lib/execution/runtime').ExecutionRuntime,
    loggers = require('@ama-team/voxengine-sdk').loggers,
    sinon = require('sinon'),
    chai = require('chai'),
    should = chai.should(),
    assert = chai.assert;

chai.use(require('chai-as-promised'));

describe('/execution', function () {

    var logs,
        logger,
        /**
         * @function
         * @param {StateDeclaration[]} states
         * @return {StateMachine}
         */
        factory;

    beforeEach(function () {
        logs = [];
        var writer = {
            write: function (message) {
                logs.push(message);
            }
        };
        logger = new loggers.slf4j(writer, loggers.LogLevel.ALL);
        factory = function (states) {
            return new StateMachine(states, new ExecutionRuntime(), logger);
        }
    });

    afterEach(function () {
        if (!('allure' in global)) {
            // nothing to do here -_-
            return;
        }
        if (logs.length) {
            allure.createAttachment('state-machine.log', logs.join('\n'), 'text/plain');
        }
    });

    describe('state-machine.js', function () {

        describe(': basic functionality', function () {

            it('should execute straight-forward scenario', function () {
                assert.fail('slothful test');
                var transitionA = sinon.spy(function () {
                        return Promise.resolve({
                            transitionedTo: 'initialized',
                            trigger: {
                                id: 'terminated'
                            }
                        });
                    }),
                    transitionB = sinon.spy(function () {
                        return Promise.resolve({
                            transitionedTo: 'terminated',
                            trigger: null
                        });
                    }),
                    states = [
                        {
                            id: 'initialized',
                            transition: transitionA,
                            terminal: false
                        },
                        {
                            id: 'terminated',
                            transition: transitionB,
                            terminal: true
                        }
                    ],
                    machine = factory(states);

                machine.transitionTo('initialized');
                return machine.getCompletion();
            });

        });

        describe(': timeouts', function () {

        });

        describe(': common execution cases', function () {

        });

    });

});