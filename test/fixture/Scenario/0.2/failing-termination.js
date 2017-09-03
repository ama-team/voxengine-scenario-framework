var Schema = require('../../../../lib/Schema')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

module.exports = {
  name: 'Failing onTermination handler',
  description: 'Simply checks that onTermination error doesn\t mean end of the world',
  type: TriggerType.Http,
  setup: {},
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: function () {
          return {trigger: {id: 'terminal'}}
        }
      },
      terminal: {
        transition: function () {},
        terminal: true
      }
    },
    onTermination: function () {
      throw new Error()
    }
  },
  assertions: {
    result: {
      status: OperationStatus.Failed,
      stages: {
        initialization: {
          status: OperationStatus.Finished
        },
        scenario: {
          status: OperationStatus.Finished
        },
        termination: {
          status: OperationStatus.Failed
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
