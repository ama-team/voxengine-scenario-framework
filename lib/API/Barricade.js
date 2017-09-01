var Schema = require('../Schema')
var Normalizer = Schema.Normalizer
var Validator = Schema.Validator
var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j
var Printer = require('./Printer').Printer

/**
 * @param {object} [options]
 *
 * @class
 */
function Barricade (options) {
  options = options || {}
  var logger = Slf4j.factory(options.logger, 'ama-team.vsf.barricade')

  /**
   * @param {TScenarioInput} input
   * @return {TScenario}
   */
  this.scenario = function (input) {
    var violations = Validator.scenario(input)
    logger.info('Running scenario validation')
    var printer = new Printer(options.logger)
    printer.violations(violations)
    if (violations.severity === Validator.Severity.Fatal) {
      throw new Error('Scenario validation has failed')
    }
    return Normalizer.scenario(input)
  }
}

module.exports = {
  Barricade: Barricade
}
