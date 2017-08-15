/* eslint-env mocha */

var helper = require('../../../helper/common')
var schema = require('../../../../lib/schema/definitions')
var MachineTerminationResult = schema.MachineTerminationResult
var TerminationCause = schema.TerminationCause
var Scenario = schema.Scenario
var TriggerType = schema.TriggerType
var execution = require('../../../../lib/execution/execution')
var Execution = execution.Execution
var chai = require('chai')
var assert = chai.assert
var sinon = require('sinon')

describe('/execution', function () {
  var stateMachineFactory = function (cause, error, state) {
    return {
      run: sinon.spy(helper.resolvedFactory(new MachineTerminationResult(cause, error, state)))
    }
  }
  var runtimeFactory = function (value) {
    return {
      execute: sinon.spy(function () {
        var result = null
        if (arguments.length) {
          result = arguments[0].apply({}, Array.prototype.slice.call(arguments, 1))
        }
        return result || Promise.resolve(value)
      })
    }
  }
  var scenarioFactory = function (onTermination, onTerminationTimeout, timeouts) {
    timeouts = timeouts || new schema.Timeouts({onTermination: null, onTerminationTimeout: null})
    onTerminationTimeout = onTerminationTimeout || function (token, error) {
      throw error
    }
    onTermination = onTermination || helper.resolvedFactory({})
    var scenario = new Scenario([], TriggerType.Http)
    scenario.onTermination = sinon.spy(onTermination)
    scenario.onTerminationTimeout = sinon.spy(onTerminationTimeout)
    scenario.timeouts = timeouts
    return scenario
  }

  describe('/execution.js', function () {
    describe('.Execution', function () {
      helper.setup()

      it('should correctly execute scenario', function () {
        var scenario = scenarioFactory()
        var runtime = runtimeFactory({})
        var machine = stateMachineFactory(TerminationCause.Completion)
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function (result) {
          assert(result.success)
          assert.equal(result.cause, TerminationCause.Completion)
          assert.isNull(result.error)
          assert.isNull(result.state)

          assert(runtime.execute.callCount > 0)
          assert(machine.run.calledOnce)
          assert(scenario.onTermination.calledOnce)
          assert.equal(scenario.onTerminationTimeout.callCount, 0)
        })
      })

      it('should run onTerminationTimeout on termination handler timeout', function () {
        var scenario = scenarioFactory(
          function (t) {
            return t.getPromise()
          },
          helper.resolvedFactory({}),
          {onTermination: 1}
        )
        var runtime = runtimeFactory({})
        var machine = stateMachineFactory(TerminationCause.Completion)
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function (result) {
          assert(result.success)
          assert.equal(result.cause, TerminationCause.Completion)
          assert.isNull(result.error)
          assert.isNull(result.state)

          assert(runtime.execute.callCount > 0)
          assert(machine.run.calledOnce)
          assert(scenario.onTermination.calledOnce)
          assert(scenario.onTerminationTimeout.calledOnce)
        })
      })

      it('should not report success if termination handler has failed', function () {
        var error = new Error()
        var scenario = scenarioFactory(function () { return Promise.reject(error) })
        var runtime = runtimeFactory({})
        var machine = stateMachineFactory(TerminationCause.Completion)
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function (result) {
          assert(!result.success)
          assert.equal(result.cause, TerminationCause.Completion)
          assert.isNull(result.error)
          assert.isNull(result.state)
          assert.equal(result.terminationError, error)

          assert(runtime.execute.callCount > 0)
          assert(machine.run.calledOnce)
          assert(scenario.onTermination.calledOnce)
          assert.equal(scenario.onTerminationTimeout.callCount, 0)
        })
      })

      it('should catch inadequate state machine result', function () {
        var scenario = scenarioFactory()
        var runtime = runtimeFactory({})
        var machine = {
          run: sinon.spy(function () {
            return Promise.resolve({})
          })
        }
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function (result) {
          assert(!result.success)
          assert.equal(result.cause, TerminationCause.FrameworkFailure)
          assert.isNull(result.state)
          assert.isNull(result.terminationError)

          assert(machine.run.calledOnce)
          assert.equal(scenario.onTermination.callCount, 1)
          assert.equal(scenario.onTerminationTimeout.callCount, 0)
        })
      })

      it('should catch state machine error', function () {
        var error = new Error()
        var scenario = scenarioFactory()
        var runtime = runtimeFactory({})
        var machine = {
          run: sinon.spy(function () {
            return Promise.reject(error)
          })
        }
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function (result) {
          assert(!result.success)
          assert.equal(result.cause, TerminationCause.FrameworkFailure)
          assert.equal(result.error, error)
          assert.isNull(result.state)
          assert.isNull(result.terminationError)

          assert(machine.run.calledOnce)
          assert.equal(scenario.onTermination.callCount, 1)
          assert.equal(scenario.onTerminationTimeout.callCount, 0)
        })
      })

      it('should catch double execution', function () {
        var scenario = scenarioFactory()
        var runtime = runtimeFactory({})
        var machine = {
          run: sinon.spy(helper.resolvedFactory({}))
        }
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function () {
          return execution.run()
        }).then(function (result) {
          assert(!result.success)
          assert.equal(result.cause, TerminationCause.InvalidUsage)
        })
      })

      it('should timeout excessively long scenario', function () {
        var scenario = scenarioFactory(null, null, {scenario: 1})
        var runtime = runtimeFactory()
        var machine = {
          run: sinon.spy(helper.infinite)
        }
        var execution = new Execution(scenario, machine, runtime, helper.getLogger())

        return execution.run().then(function (result) {
          assert(!result.success)
          assert.equal(result.cause, TerminationCause.ScenarioTimeout)
          assert(machine.run.calledOnce)
        })
      })
    })
  })
})
