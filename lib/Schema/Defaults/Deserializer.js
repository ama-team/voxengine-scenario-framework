var Slf4j = require('@ama-team/voxengine-sdk').Logger.Slf4j

module.exports = {
  /**
   * @param {LoggerOptions} [options]
   *
   * @return {Function}
   */
  factory: function (options) {
    var name = 'ama-team.vsf.schema.defaults.deserializer'
    var logger = Slf4j.factory(options, name)
    return function (input) {
      if (!input || input === '') {
        logger.debug('Provided input is a falsey value, returning empty object')
        return {}
      }
      if (typeof input !== 'string') {
        logger.debug('Provided input is not a string, returning object with ' +
          'input as $.customData')
        return {customData: input}
      }
      try {
        return JSON.parse(input)
      } catch (e) {
        logger.warn('Failed to deserialize JSON from {}, returning object ' +
          'with input as $.customData', input)
        return {customData: input}
      }
    }
  }
}
