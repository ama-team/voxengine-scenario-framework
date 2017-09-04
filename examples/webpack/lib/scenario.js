var Framework = require('@ama-team/voxengine-scenario-framework')

var scenario = {
  id: 'Testing scenario',
  version: '0.1.0',
  environment: 'testing',
  trigger: Framework.TriggerType.Http,
  arguments: {
    greeting: 'Hi there, handsome!'
  },
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
      transition: function (_, hints) {
        var call = VoxEngine.callPSTN(hints.target)
        var self = this
        this.state.call = call
        call.addEventListener(CallEvents.Connected, function () {
          self.transitionTo('greeted')
        })
        call.addEventListener(CallEvents.Failed, function () {
          self.transitionTo('callFailed')
        })
      },
      entrypoint: true
    },
    callFailed: function () {
      this.info('Sadly, our recipient has chosen not to respond')
      return {trigger: 'terminated'}
    },
    greeted: function () {
      this.info('He has answered!')
      this.state.call.say(this.arguments.greeting, Language.US_ENGLISH_FEMALE)
      var self = this
      this.state.call.addEventListener(CallEvents.PlaybackFinished, function () {
        self.transitionTo('terminated')
      })
    },
    terminated: {
      transition: function () {
        if (this.state.call.state() === 'PROGRESSING') {
          this.state.call.hangup()
        }
        this.info('Terminating scenario')
      },
      terminal: true
    }
  },
  onTermination: function () {
    this.info('onTermination hook is running')
  }
}

Framework.run(scenario)
