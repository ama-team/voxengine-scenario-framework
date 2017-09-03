var Sinon = require('sinon')

var Objects = require('../../../../lib/Utility').Objects
var Barricade = require('../../../../lib/API').Barricade
var Deserializer = require('../../../../lib/Schema/Defaults').Deserializer

var Normalizer = {
  normalize: function (fixture, id) {
    fixture = Objects.copy(fixture)
    fixture.id = fixture.id || id
    this.name = fixture.name || fixture.id
    fixture.scenario.id = fixture.id
    var structure = {
      result: {
        stages: {
          scenario: {},
          termination: {}
        }
      },
      handlers: {
        state: {},
        onError: {},
        onTermination: {}
      }
    }
    fixture.assertions = Objects.merge(structure, fixture.assertions)
    fixture.setup = fixture.setup || {}
    fixture.scenario = Normalizer.scenario(fixture.scenario)
    return fixture
  },
  scenario: function (scenario) {
    Object.keys(scenario.states).forEach(function (id) {
      var state = scenario.states[id]
      var handlers = ['transition', 'abort']
      handlers.forEach(function (handler) {
        state[handler] = Normalizer.handler(state[handler], handler)
      })
      scenario.states[id] = state
    })
    scenario.deserializer = scenario.deserializer || Deserializer
    var handlers = ['deserializer', 'onError', 'onTermination']
    handlers.forEach(function (handler) {
      scenario[handler] = Normalizer.handler(scenario[handler], handler)
    })
    return (new Barricade()).scenario(scenario)
  },
  handler: function (handler, id) {
    if (!handler) {
      handler = {handler: null}
    }
    if (Objects.isFunction(handler)) {
      handler = {handler: handler}
    }
    handler.id = id
    handler.handler = Sinon.spy(handler.handler)
    if (handler.onTimeout) {
      handler.onTimeout = Normalizer.handler(handler.onTimeout, 'on' + id + 'timeout')
    }
    return handler
  }
}

module.exports = {
  Normalizer: Normalizer
}
