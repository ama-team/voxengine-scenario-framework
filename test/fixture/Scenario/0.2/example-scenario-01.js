var Schema = require('../../../../lib/Schema')
var Objects = require('../../../../lib/Utility').Objects
var TriggerType = Schema.TriggerType
var OperationStatus = Schema.OperationStatus

var args = {target: 252}
var greeting = {
  greeting: 'Hi there, handsome!'
}

module.exports = {
  name: 'Backpropagated error scenario #01',
  type: TriggerType.Call,
  setup: {
    customData: JSON.stringify(args)
  },
  scenario: {
    id: 'Testing scenario',
    version: '0.1.0',
    environment: 'testing',
    trigger: TriggerType.Http,
    arguments: greeting,
    deserializer: function (input) {
      var data
      try {
        data = JSON.parse(input)
      } catch (e) {
        throw new Error('Invalid JSON supplied')
      }
      if (!data.target) {
        throw new Error('Provided data did not contain phone number as $.target property')
      }
      return data
    },
    states: {
      entrypoint: {
        transition: function () {
          // var call = VoxEngine.callPSTN(hints.target)
          var self = this
          // this.state.call = call
          // call.addEventListener(CallEvents.Connected, function () {
          //   self.transitionTo('greeted')
          // })
          // call.addEventListener(CallEvents.Failed, function () {
          //   self.transitionTo('callFailed')
          // })
          setTimeout(function () {
            self.transitionTo('greeted')
          }, 10)
        },
        entrypoint: true
      },
      callFailed: function () {
        this.info('Sadly, our recipient has chosen not to respond')
        return {trigger: 'terminated'}
      },
      greeted: function () {
        this.info('He has answered!')
        // this.state.call.say(this.arguments.greeting, Language.US_ENGLISH_FEMALE)
        var self = this
        // this.state.call.addEventListener(CallEvents.PlaybackFinished, function () {
        //   self.transitionTo('terminated')
        // })
        setTimeout(function () {
          self.transitionTo('terminated')
        }, 10)
      },
      terminated: {
        transition: function () {
          // if (this.state.call.state() === 'PROGRESSING') {
          //   this.state.call.hangup()
          // }
          this.info('Terminating scenario')
        },
        terminal: true
      }
    },
    onTermination: function () {
      this.info('onTermination hook is running')
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
            count: 1,
            calls: [
              {
                arguments: [null, Objects.merge(args, greeting)]
              }
            ]
          }
        },
        greeted: {
          transition: {
            count: 1,
            calls: [
              {
                arguments: ['entrypoint']
              }
            ]
          }
        },
        terminated: {
          transition: {
            count: 1,
            calls: [
              {
                arguments: ['greeted']
              }
            ]
          }
        }
      }
    }
  }
}
