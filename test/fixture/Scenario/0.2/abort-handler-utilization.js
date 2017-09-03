var Schema = require('../../../../lib/Schema/index')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

module.exports = {
  id: 'abort-handler-utilization',
  name: 'Scenario with abort handlers application',
  type: TriggerType.Http,
  setup: {},
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: function (p, h, token) {
          setTimeout(this.transitionTo.bind(this, 'terminal'), 0)
          return token
        }
      },
      terminal: {
        transition: function () {
          this.info('time for termination')
        },
        terminal: true
      }
    }
  },
  assertions: {
    result: {
      status: OperationStatus.Finished,
      stages: {
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
          },
          abort: {
            count: 1
          }
        },
        terminal: {
          transition: {
            count: 1
          }
        }
      }
    }
  }
}
