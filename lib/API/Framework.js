/* global VoxEngine */

var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j
var Barricade = require('./Barricade').Barricade
var Run = require('../Execution').Run
var Binder = require('../Adapter/Binder').Binder
var Printer = require('./Printer').Printer
var OperationStatus = require('../Schema').OperationStatus

/**
 * Main library class that provides public API.
 *
 * @param {TFrameworkOptions} [options]
 *
 * @class
 */
function Framework (options) {
  var self = this
  options = options || {}
  options.behavior = options.behavior || {terminate: true}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.framework')
  var printer = new Printer(options.logger)

  /**
   * Runs provided scenario.
   *
   * @param {TScenarioInput} scenario
   *
   * @return {TRunResult}
   */
  this.run = function (scenario) {
    return self.execute(self.prepare(scenario))
  }

  /**
   * Executes prepared Run
   *
   * @param {Run} run
   *
   * @return {TRunResult}
   */
  this.execute = function (run) {
    printer.scenario(run.getScenario())
    run.initialize()
    Binder.bind(run)
    return run
      .getCompletion()
      .then(printer.result, function (reason) {
        logger.error('Unexpected error during execution:', reason)
        return {
          status: OperationStatus.Tripped,
          error: reason,
          stages: {}
        }
      })
      .then(function (result) {
        if (options.behavior.terminate) {
          logger.debug('Shutting down VoxEngine')
          VoxEngine.terminate()
        }
        return result
      })
  }

  /**
   * Creates run from scenario input.
   *
   * @param {TScenarioInput} scenario
   *
   * @return {Run}
   */
  this.prepare = function (scenario) {
    try {
      var barricade = new Barricade({logger: options.logger, printer: printer})
      var normalized = barricade.scenario(scenario)
      var settings = {
        state: scenario.state || {},
        arguments: scenario.arguments || {},
        logger: options.logger
      }
      return new Run(normalized, normalized.deserializer, settings)
    } catch (e) {
      logger.error('Failed to create run, most probably due to invalid scenario')
      throw e
    }
  }
}

module.exports = {
  Framework: Framework
}
