/* eslint-disable no-unused-expressions */

var Chai = require('chai')
var expect = Chai.expect

function validate (name, callable) {
  global.allure.createStep(name, callable)()
}

function Verifier (fixture) {
  function verifyResult (result) {
    var asserts = fixture.assertions.result
    if (asserts.status) {
      validate('Result status is ' + asserts.status.id, function () {
        expect(result.status).to.eq(asserts.status)
      })
    }
    Object.keys(asserts.stages).forEach(function (name) {
      verifyStageResult(name, result.stages[name], asserts.stages[name])
    })
  }

  function verifyStageResult (id, result, assertions) {
    if (assertions === null) {
      validate('Stage ' + id + ' hasn\'t been run', function () {
        expect(result).to.be.null
      })
      return
    }
    if (assertions.hasOwnProperty('status')) {
      validate('Stage ' + id + ' status is ' + assertions.status.id, function () {
        expect(result).to.have.property('status').eq(assertions.status)
      })
    }
  }

  function verifyHandlers () {
    var asserts = fixture.assertions.handlers
    verifyStateHandlers(fixture.scenario.states, asserts.state)
    var handlers = ['onError', 'onTermination', 'deserializer']
    handlers.forEach(function (handler) {
      verifyHandler(handler, fixture.scenario[handler], asserts[handler])
    })
  }

  function verifyStateHandlers (states, assertions) {
    Object.keys(assertions).forEach(function (name) {
      var handlerAsserts = assertions[name]
      var state = states[name]
      Object.keys(handlerAsserts).forEach(function (handlerName) {
        var path = handlerName.split('.')
        var handler = path.reduce(function (carrier, name) {
          return carrier[name]
        }, state)
        var id = state.id + '.' + handlerName
        verifyHandler(id, handler, handlerAsserts[handlerName])
      })
    })
  }

  function verifyHandler (id, handler, assertions) {
    if (!assertions) {
      return
    }
    var prefix = 'Handler ' + id
    validate(prefix + ' exists', function () {
      expect(handler).to.be.ok
    })
    if (assertions.hasOwnProperty('count')) {
      var name = prefix + ' has been called exactly ' + assertions.count +
        ' times'
      validate(name, function () {
        expect(handler.handler.callCount).to.eq(assertions.count)
      })
    }
    verifyCalls(prefix, handler.handler, assertions.calls)
  }

  function verifyCalls (name, callable, calls) {
    if (!Array.isArray(calls)) {
      return
    }
    for (var i = 0; i < calls.length; i++) {
      verifyCallArguments(name, callable, i, calls[i].arguments)
    }
  }

  function verifyCallArguments (name, callable, call, args) {
    for (var i = 0; i < args.length; i++) {
      (function (index) {
        var argument = args[index]
        var assertion = name + ' has been passed ' + JSON.stringify(argument) +
          ' as argument #' + i + ' of call #' + call
        validate(assertion, function () {
          expect(callable.callCount).to.be.at.least(call + 1)
          expect(callable.getCall(call).args[index]).to.deep.eq(argument)
        })
      })(i)
    }
  }

  this.verify = function (result) {
    verifyResult(result)
    verifyHandlers()
  }
}

module.exports = {
  Verifier: Verifier
}
