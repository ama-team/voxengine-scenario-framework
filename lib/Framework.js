/* global VoxEngine */

var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var Future = SDK.Concurrent.Future
var Schema = require('./Schema')
var Validator = Schema.Validator
var Normalizer = Schema.Normalizer
var TriggerType = Schema.TriggerType
var Objects = require('./Utility').Objects
var Runner = require('./Runner').Runner
var Binding = require('./Binding')

function Framework (options) {
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.framework')

  function validate (input) {
    var violations = Validator.scenario(input)
    logger.info('Running scenario validation')
    Object.keys(violations).forEach(function (path) {
      violations[path].forEach(function (v) {
        var severe = v.severity.weight > Validator.Severity.Minor
        var method = severe ? 'warn' : 'info'
        logger[method]('{}: {} ({})', path, v.message, v.severity.id)
      })
    })
    if (violations.severity === Validator.Severity.Fatal) {
      return Promise.reject(new Error('Scenario validation has failed'))
    }
    return Promise.resolve()
  }

  function bind (runner, type) {
    var binding = Binding.index.trigger[type]
    var future = new Future()
    VoxEngine.addEventListener(binding.getEventType(), function (event) {
      try {
        var trigger = binding.extractTrigger(event)
        runner
          .run(trigger)
          .then(function (result) {
            future.resolve(result)
          }, function (reason) {
            future.reject(reason)
          })
      } catch (e) {
        future.reject(e)
      }
    })
    return future
  }

  this.run = function (input) {
    return validate(input)
      .then(function () {
        var scenario = Normalizer.scenario(input)
        var opts = Objects.copy(options)
        opts.deserializer = input.deserializer || function () {}
        var runner = new Runner(scenario, opts)
        return bind(runner, TriggerType.find(input.trigger))
      })
      .then(processResult, function (reason) {
        logger.error('Unexpected error during execution:', reason)
      })
      .then(function () {
        // TODO: make termination configurable
        logger.debug('Shutting down VoxEngine')
        VoxEngine.terminate()
      })
  }

  /**
   * @param {TExecutionResult} result
   */
  function processResult (result) {
    var method = result.status.successful ? 'notice' : 'error'
    logger[method]('Framework run has finished with status {}', result.status.id)
    var parts = ['Scenario', 'Termination']
    parts.forEach(function (name) {
      var outcome = result[name.toLowerCase()]
      if (outcome.status.successful) {
        logger.info('{} has successfully finished in {} ms with value {}',
          name, outcome.duration, outcome.value)
      } else {
        logger.error('{} has finished in {} ms with error:', name,
          outcome.duration, outcome.value)
      }
    })
    logger.debug('Recapping scenario state history (limited to 100 entries):')
    result.history.forEach(logger.debug.bind(logger, '{}'))
  }

  this.validate = Validator.scenario
}

Framework.run = function (input, options) {
  return new Framework(options).run(input)
}

Framework.validate = Validator.scenario

Framework.TriggerType = TriggerType

module.exports = {
  Framework: Framework
}
