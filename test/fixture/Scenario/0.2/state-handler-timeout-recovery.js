var Schema = require('../../../../lib/Schema')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

module.exports = {
  name: 'State handler timeout recovery',
  description: 'Validates that state handler may recover from timeout using provided handler',
  type: TriggerType.Http,
  setup: {},
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: {
          handler: function () {
            return new Promise(function () {})
          },
          onTimeout: function () {
            return {trigger: {id: 'terminal'}}
          }
        }
      },
      terminal: {
        transition: function () {},
        terminal: true
      }
    },
    timeouts: {
      transition: 0
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
            count: 1
          }
        }
      },
      deserializer: {
        count: 1
      },
      onError: {
        count: 0
      },
      onTermination: {
        count: 1
      }
    }
  }
}
