var factory = function (id, successful) {
  var terminal = typeof successful === 'boolean'
  return {
    id: id,
    terminal: terminal,
    successful: terminal ? successful : null
  }
}

module.exports = {
  /**
   * @enum {TOperationStatus}
   * @readonly
   */
  OperationStatus: {
    None: factory('None'),
    Running: factory('Running'),
    Aborted: factory('Aborted', true),
    Finished: factory('Finished', true),
    Failed: factory('Failed', false),
    Tripped: factory('Tripped', false)
  }
}
