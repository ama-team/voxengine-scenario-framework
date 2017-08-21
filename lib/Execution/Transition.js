var SDK = require('@ama-team/voxengine-sdk');
var Slf4j = SDK.Logger.Slf4j
var CancellationToken = SDK.Concurrent.CancellationToken
var Future = SDK.Concurrent.Future
var timeout = SDK.Concurrent.timeout
var TimeoutException = SDK.Concurrent.TimeoutException

/**
 * @typedef {object} TransitionResult
 * @property {int} duration
 * @property {Status} status
 */

/**
 * @namespace
 */
var Status = {
  Idle: 'Idle',
  Executing: 'Executing',
  ExecutingRescue: 'Executing/Rescue',
  Completed: 'Finished',
  ExecutionFailure: 'Failed',
  Aborting: 'Aborting',
  AbortingRescue: 'Aborting/Rescue',
  Aborted: 'Aborted',
  AbortFailure: 'AbortFailure',
  Tripped: 'Tripped'
}

/**
 * Represents transition from one state to another
 *
 * @param {State} origin
 * @param {State} target
 * @param {object} options
 * @class
 */
function Transition (origin, target, options) {
  options = options || {}
  var loggerName = 'ama-team.voxengine-scenario-framework.execution.transition'
  var logger = Slf4j.factory(options.logger, loggerName)
  logger.attach('origin', origin && origin.id || 'null')
  logger.attach('target', target.id)
  var execution = new Future()
  var abort = new Future()
  var completion = new Future()
  var status = Status.Idle
  var token = new CancellationToken()
  var start
}

module.exports = {
  Transition: Transition
}
