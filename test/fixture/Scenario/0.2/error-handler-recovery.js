var Schema = require('../../../../lib/Schema')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

module.exports = {
  name: 'Error handler recovery',
  description: 'This scenario verifies that error handler ' +
    'has the option to return scenario in working state',
  type: TriggerType.Http,
  setup: {},
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: function () {
          this.info('Launching error handler')
          throw new Error()
        }
      },
      terminal: {
        transition: function (previous) {
          this.info('termination state, let\'s check who\'s knocking')
          if (previous !== null) {
            throw new Error('heck, didn\'t expect that!')
          }
        },
        terminal: true
      }
    },
    onError: function () {
      return {trigger: {id: 'terminal'}}
    }
  },
  assertions: {
    result: {
      status: OperationStatus.Finished,
      stages: {
        initialization: {
          status: OperationStatus.Finished
        },
        scenario: {
          status: OperationStatus.Finished
        },
        termination: {
          status: OperationStatus.Finished
        }
      }
    },
    handlers: {
      state: {
        entrypoint: {
          transition: {
            count: 1
          }
        },
        terminal: {
          transition: {
            count: 1,
            calls: [
              {
                arguments: [null]
              }
            ]
          }
        }
      },
      onError: {
        count: 1
      },
      onTermination: {
        count: 1
      }
    }
  }
}
