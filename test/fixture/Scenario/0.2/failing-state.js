var Schema = require('../../../../lib/Schema')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

module.exports = {
  name: 'Failing state',
  description: 'Verifies that failed transition fails whole run',
  type: TriggerType.Http,
  setup: {},
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: function () {
          throw new Error()
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
          status: OperationStatus.Finished
        },
        scenario: {
          status: OperationStatus.Failed
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
            count: 0
          }
        }
      },
      deserializer: {
        count: 1
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
