var Schema = require('../../../../lib/Schema/index')
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus
var hints = {
  entrypoint: {grapes: 'berry', oranges: 'fruit'},
  terminal: {'oh hi chris': null}
}

module.exports = {
  id: 'simple-scenario',
  type: TriggerType.Http,
  setup: {
    customData: JSON.stringify(hints.entrypoint)
  },
  scenario: {
    states: {
      entrypoint: {
        entrypoint: true,
        transition: function (_, hints) {
          this.state.logger.info('look what have been passed: {}', hints)
          return 'intermediate'
        }
      },
      intermediate: {
        transition: function () {
          this.state.logger.info('this state should trigger next via external `$.triggers` property')
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
          this.state.logger.info('time for a termination')
          this.state.logger.info('by the way, these are the hints: {}', hints)
        },
        terminal: true
      }
    }
  },
  assertions: {
    result: {
      scenario: {
        status: OperationStatus.Finished
      },
      termination: {
        status: OperationStatus.Finished
      }
    },
    handlers: {
      state: {
        entrypoint: {
          transition: {
            count: 1,
            calls: [
              {
                origin: null,
                hints: hints.entrypoint
              }
            ]
          }
        },
        intermediate: {
          transition: {
            count: 1,
            calls: [
              {
                origin: 'entrypoint',
                hints: {}
              }
            ]
          }
        },
        terminal: {
          transition: {
            count: 1,
            calls: [
              {
                origin: 'intermediate',
                hints: hints.terminal
              }
            ]
          }
        }
      }
    }
  }
}
