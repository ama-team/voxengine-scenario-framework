var Schema = require('../../../../lib/Schema')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

module.exports = {
  name: 'Failing deserializer',
  description: 'Checks that scenario won\'t be run in case of faulty deserializer',
  type: TriggerType.Http,
  setup: {},
  scenario: {
    deserializer: function () {
      throw new Error()
    },
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
    }
  },
  assertions: {
    result: {
      status: OperationStatus.Failed,
      stages: {
        initialization: {
          status: OperationStatus.Failed
        },
        scenario: null,
        termination: {
          status: OperationStatus.Finished
        }
      }
    },
    handlers: {
      state: {
        entrypoint: {
          transition: {
            count: 0
          }
        },
        terminal: {
          transition: {
            count: 0
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
