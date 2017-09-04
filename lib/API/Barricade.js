var Schema = require('../Schema')
var Normalizer = Schema.Normalizer
var Validator = Schema.Validator
var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j
var Printer = require('./Printer').Printer
var InvalidInputError = require('../Error').InvalidInputError

/**
 * This class provide so-called barricade functionality - it validates
 * and converts user input and, if input is invalid, prevents following
 * actions by raising an exception.
 *
 * @param {TBarricadeOptions} [options]
 *
 * @class
 */
function Barricade (options) {
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.barricade')
  var printer = options.printer || new Printer(options.logger)

  /**
   * @param {TScenarioInput} input
   * @return {TScenario}
   */
  this.scenario = function (input) {
    var violations = Validator.scenario(input)
    logger.info('Running scenario validation')
    printer.violations(violations)
    if (violations.severity === Validator.Severity.Fatal) {
      throw new InvalidInputError('Scenario validation has failed')
    }
    return Normalizer.scenario(input)
  }
}

module.exports = {
  Barricade: Barricade
}
