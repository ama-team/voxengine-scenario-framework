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
      var stage = asserts.stages[name]
      if (stage.status) {
        validate('Stage ' + name + ' status is ' + stage.status.id, function () {
          expect(result.stages[name]).to.have.property('status').eq(stage.status)
        })
      }
    })
  }

  function verifyHandlers () {
    var asserts = fixture.assertions.handlers
    var states = fixture.scenario.states
    Object.keys(asserts.state).forEach(function (name) {
      var handlerAsserts = asserts.state[name]
      var state = states[name]
      Object.keys(handlerAsserts).forEach(function (handlerName) {
        var path = handlerName.split('.')
        var handler = path.reduce(function (carrier, name) {
          return carrier[name]
        }, state)
        var id = state.id + '.' + handlerName
        verifyStateHandler(id, handler, handlerAsserts[handlerName])
      })
    })
  }

  function verifyStateHandler (id, handler, asserts) {
    var prefix = 'Handler ' + id
    if (asserts.hasOwnProperty('count')) {
      validate(prefix + ' was executed ' + asserts.count + ' times', function () {
        expect(handler.handler.callCount).eq(asserts.count)
      })
    }
    var calls = asserts.calls || []
    for (var i = 0; i < calls.length; i++) {
      var args = asserts.calls[i].arguments || []
      for (var j = 0; j < args.length; j++) {
        var arg = args[j]
        var assertion = (function (i, j, arg) {
          return function () {
            expect(handler.handler.getCall(i).args[j]).to.deep.eq(arg)
          }
        })(i, j, arg)
        var representation = JSON.stringify(arg)
        var name = prefix + ' has been called with ' + representation +
          ' as argument #' + j + ' on call #' + i
        validate(name, assertion)
      }
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
