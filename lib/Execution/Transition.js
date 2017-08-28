var SDK = require('@ama-team/voxengine-sdk')
var Slf4j = SDK.Logger.Slf4j
var CancellationToken = SDK.Concurrent.CancellationToken
var Future = SDK.Concurrent.Future
var Branch = require('./Transition/Branch').Branch

var statusFactory = function (id, successful) {
  var terminal = typeof successful === 'boolean'
  return {
    id: id,
    terminal: terminal,
    successful: terminal ? successful : null
  }
}

/**
 * @enum
 * @readonly
 */
var Status = {
  Idle: statusFactory('Idle'),
  Executing: statusFactory('Executing'),
  Aborting: statusFactory('Aborting'),
  /**
   * Transition has completed successfully
   */
  Executed: statusFactory('Executed', true),
  /**
   * Transition has been aborted successfully
   */
  Aborted: statusFactory('Aborted', true),
  /**
   * Transition has failed and thrown an error during normal execution
   */
  ExecutionFailure: statusFactory('ExecutionFailure', false),
  /**
   * Transition has been aborted and encountered an error during abort
   */
  AbortFailure: statusFactory('AbortFailure', false),
  /**
   * Transition has ended with error triggered by framework
   */
  Tripped: statusFactory('Tripped', false)
}

/**
 * @typedef {object} Transition~Options
 *
 * @property {TState} [origin]
 * @property {TState} target
 * @property {THints} hints
 * @property {LoggerOptions} [logger]
 * @property {IExecutor} executor
 */

/**
 * Represents transition from one state to another
 *
 * @param {Transition~Options} options
 *
 * @class
 */
function Transition (options) {
  var self = this
  if (!options || !options.target) {
    throw new Error('Target state not provided')
  }
  var loggerName = 'ama-team.vsf.execution.transition'
  var origin = options.origin
  var target = options.target
  var originId = (origin && origin.id) || null
  var hints = options.hints
  options.logger = options.logger || {}
  options.logger.mdc = options.logger.mdc || {}
  options.logger.mdc['origin'] = originId
  options.logger.mdc['target'] = target.id
  var logger = Slf4j.factory(options.logger, loggerName)

  var token = new CancellationToken()
  var completion = new Future()
  var status = Status.Idle

  var launchedAt = null

  /**
   * @param {Transition.Status} next
   */
  function setStatus (next) {
    logger.trace('Changing status from {} to {}', status.id, next.id)
    status = next
  }

  function executionOptions (name) {
    return {
      name: name,
      handler: target[name],
      logger: options.logger,
      executor: options.executor
    }
  }

  /**
   * Returns function that will generate ITransitionResult from provided
   * value.
   *
   * @param {Status} status
   * @return {Function}
   */
  function factory (status) {
    return function (value) {
      return {
        value: value,
        status: status,
        duration: (new Date()).getTime() - launchedAt.getTime()
      }
    }
  }

  /**
   * Completes transition with provided result, if
   *
   * @param {TTransitionResult} result
   * @param {Status} [requiredStatus]
   */
  function complete (result, requiredStatus) {
    if (requiredStatus && status !== requiredStatus) {
      return
    }
    setStatus(result.status)
    logger.debug('Transition has ended with status {} and value {} in {} ms',
      status.id, result.value, result.duration)
    completion.resolve(result)
  }

  function run () {
    if (status !== Status.Idle) {
      throw new Error('Tried to run ' + self + ' twice')
    }
    logger.debug('Running transition')
    launchedAt = new Date()
    setStatus(Status.Executing)
    var opts = executionOptions('transition')
    var execution = new Branch(opts)
    execution
      .run(originId, hints, token)
      .then(factory(Status.Executed), factory(Status.ExecutionFailure))
      .then(function (result) {
        var level = result.status.successful ? 'debug' : 'warn'
        var term = result.status.successful ? 'success' : 'error'
        logger[level]('Transition run has finished with {}: {}', term,
          result.value)
        complete(result, Status.Executing)
      })
    return completion
  }

  function abort () {
    if (status !== Status.Executing) {
      throw new Error('Tried to abort ' + self)
    }
    setStatus(Status.Aborting)
    var options = executionOptions('abort')
    var execution = new Branch(options)
    execution
      .run(originId, hints)
      .then(factory(Status.Aborted), factory(Status.AbortFailure))
      .then(function (result) {
        var level = result.status.successful ? 'debug' : 'warn'
        var term = result.status.successful ? 'success' : 'error'
        logger[level]('Transition abort has finished with {}: {}', term,
          result.value)
        complete(result, Status.Aborting)
      })
    return completion
  }

  this.run = run

  this.abort = abort

  this.getStatus = function () {
    return status
  }

  this.toString = function () {
    return 'Transition ' + originId + ' -> ' + target.id +
      ' (' + status.id + ')'
  }

  /**
   * @return {TTransitionDetails}
   */
  this.toDetails = function () {
    return {
      origin: originId,
      target: target.id,
      hints: hints
    }
  }

  /**
   * @return {int}
   */
  this.getLaunchedAt = function () { return launchedAt }

  /**
   * @return {TState}
   */
  this.getTarget = function () { return target }

  this.getOrigin = function () { return origin }

  this.getHints = function () { return hints }

  this.getCompletion = function () { return completion }
}

Transition.Status = Status

module.exports = {
  Transition: Transition
}
