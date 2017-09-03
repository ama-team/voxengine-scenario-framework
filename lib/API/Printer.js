var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j
var Validator = require('../Schema').Validator

/**
 * @param {LoggerOptions} [options]
 * @class
 */
function Printer (options) {
  var logger = Slf4j.factory(options, 'ama-team.vsf.api.printer')

  /**
   * @param {ViolationSet} violations
   */
  this.violations = function (violations) {
    var list = violations.violations
    if (!list.length) {
      return
    }
    logger.info('Found validation violations:')
    Object.keys(list).forEach(function (path) {
      list[path].forEach(function (v) {
        var severe = v.severity.weight > Validator.Severity.Minor
        var method = severe ? 'warn' : 'info'
        logger[method]('{}: {} ({})', path, v.message, v.severity.id)
      })
    })
  }

  /**
   * @param {TRunResult} result
   */
  this.result = function (result) {
    var method = result.status.successful ? 'notice' : 'error'
    logger[method]('Framework run has finished in {} ms with status {}',
      result.duration, result.status.id)
    var stages = result.stages
    Object.keys(stages).forEach(function (name) {
      var result = stages[name]
      if (!result) {
        logger.info('{} stage hasn\'t been run', name)
        return
      }
      if (result.status.successful) {
        logger.info('{} stage has successfully finished in {} ms with value {}',
          name, result.duration, result.value)
      } else {
        logger.error('{} stage has finished in {} ms with error:', name,
          result.duration, result.value)
      }
    })
    if (stages.scenario) {
      logger.debug('Recapping scenario state history (limited to 100 entries):')
      stages.scenario.history.forEach(function (e) {
        logger.debug('{} -> {}: {} (hints: {}, value: {})', e.origin, e.target,
          e.status.id, e.hints, e.value)
      })
    }
    return result
  }
}

module.exports = {
  Printer: Printer
}
