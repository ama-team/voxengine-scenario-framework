/* global VoxEngine */

var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j
var Barricade = require('./Barricade').Barricade
var Run = require('../Execution').Run
var Binder = require('../Adapter/Binder').Binder
var Printer = require('./Printer').Printer

function Framework (options) {
  var self = this
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.framework')

  this.run = function (input) {
    return self.execute(self.prepare(input))
  }

  this.execute = function (run) {
    run.initialize()
    Binder.bind(run)
    return run
      .getCompletion()
      .then(new Printer(options.logger).result, function (reason) {
        logger.error('Unexpected error during execution:', reason)
      })
      .then(function (result) {
        // TODO: make termination configurable
        logger.debug('Shutting down VoxEngine')
        VoxEngine.terminate()
        return result
      })
  }

  /**
   * @param {TScenarioInput} input
   * @return {Run}
   */
  this.prepare = function (input) {
    var scenario = (new Barricade()).scenario(input)
    var settings = {
      state: input.state || {},
      arguments: input.arguments || {},
      logger: options.logger
    }
    return new Run(scenario, input.deserializer, settings)
  }
}

module.exports = {
  Framework: Framework
}
