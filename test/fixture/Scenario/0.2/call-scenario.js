var Schema = require('../../../../lib/Schema/index')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus
var hints = {
  entrypoint: {grapes: 'berry', oranges: 'fruit'},
  terminal: {'oh hi chris': null}
}

module.exports = {
  id: 'simple-call-scenario',
  name: 'Scenario testing call alerting binding',
  type: TriggerType.Call,
  setup: {
    customData: JSON.stringify(hints.entrypoint)
  },
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: function (_, hints) {
          this.info('look what have been passed: {}', hints)
          return 'intermediate'
        }
      },
      intermediate: {
        transition: function () {
          this.info('this state should trigger next via external `$.triggers` property')
          this.state.nextStateHints = hints.terminal
        },
        triggers: {
          id: 'terminal',
          hints: function () {
            var hints = this.state.nextStateHints
            delete this.state.nextStateHints
            return hints
          }
        }
      },
      terminal: {
        transition: function (_, hints) {
          this.info('time for termination')
          this.info('by the way, these are the hints: {}', hints)
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
            count: 1,
            calls: [
              {
                arguments: [null, hints.entrypoint]
              }
            ]
          }
        },
        intermediate: {
          transition: {
            count: 1,
            calls: [
              {
                arguments: ['entrypoint', {}]
              }
            ]
          }
        },
        terminal: {
          transition: {
            count: 1,
            calls: [
              {
                arguments: ['intermediate', hints.terminal]
              }
            ]
          }
        }
      }
    }
  }
}
