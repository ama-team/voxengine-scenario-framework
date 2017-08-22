module.exports = {
  /**
   * @enum
   * @readonly
   */
  TransitionStatus: {
    Idle: 'Idle',
    Execution: 'Execution',
    ExecutionTimeout: 'ExecutionTimeout',
    Executed: 'Executed',
    ExecutionFailure: 'ExecutionFailure',
    Abort: 'Abort',
    AbortTimeout: 'AbortTimeout',
    Aborted: 'Aborted',
    AbortFailure: 'AbortFailure',
    Tripped: 'Tripped'
  }
}
