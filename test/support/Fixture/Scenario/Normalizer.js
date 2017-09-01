var Sinon = require('sinon')

var Objects = require('../../../../lib/Utility').Objects
var Barricade = require('../../../../lib/API').Barricade

var Normalizer = {
  normalize: function (fixture, id) {
    fixture = Objects.copy(fixture)
    fixture.id = fixture.id || id
    this.name = fixture.name || fixture.id
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
    scenario.onTermination = Normalizer.handler(scenario.onTermination)
    return (new Barricade()).scenario(scenario)
  },
  handler: function (handler, id) {
    handler = Normalizer.partialHandler(handler, function () {}, id)
    handler.onTimeout = Normalizer.partialHandler(handler.onTimeout, handler.handler, 'on' + id + 'timeout')
    handler.handler = Sinon.spy(handler.handler)
    handler.onTimeout.handler = Sinon.spy(handler.handler)
    return handler
  },
  partialHandler: function (handler, defaultValue, id) {
    if (!handler) {
      handler = {handler: null}
    }
    if (Objects.isFunction(handler)) {
      handler = {handler: handler}
    }
    if (!Objects.isFunction(handler.handler)) {
      handler.handler = defaultValue
    }
    handler.id = id
    return handler
  }
}

module.exports = {
  Normalizer: Normalizer
}
