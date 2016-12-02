# (Unofficial) VoxEngine Scenario Framework

This repository is dedicated for a simple framework that runs VoxEngine
scenarios.

To install this framework, simply run following command:

```
npm i @ama-team/voxengine-scenario-framework --save
```

## Diving in

This framework treats scenario as a set of states, each having a 
transition (usually that's called a callback) that leads scenario to
particular state. Simplified scenario example may look like that:

```js
var scenario = {
    states: [
        {
            id: 'connected',
            entrypoint: true,
            transition: function () {
                var self = this,
                    call = this.data.call = VoxEngine.callPSTN(this.arguments.number);
                return new Promise(function(resolve, reject) {
                    call.addEventListener(CallEvents.Connected, resolve({trigger: 'disconnected'}));
                    call.addEventListener(CallEvents.Failed, reject({}));
                });
            }
        },
        {
            id: 'messagePlayed',
            transition: function () {
                var self = this;
                return new Promise(function(resolve) {
                    self.data.call.say('It\'s me, Leha! Help me get out of the dog');
                    self.data.call.addEventListener(CallEvents.PlaybackFinished, function() {
                        resolve({trigger: 'disconnected'});
                    });
                });
            }
        },
        {
            id: 'disconnected',
            terminal: true,
            transition: function() {
                this.data.call.hangup();
            }
        }
    ],
    trigger: TriggerType.Http
}
```

Each state transition is either nothing (no operation required to 
reach state), a value, a promise or a function. Framework analyzes 
contents of `transition` property and wraps it in additional 
conversion code. After transition has been done, framework updates
current state and, if it sees `trigger` property on returned object,
triggers next transition, eventually reaching state with `terminal`
property set to `true`, and at this point it knows there won't be any 
further state.

To launch such scenario you will need code like following:

```js
var sdk = require('@ama-team/voxengine-sdk'),
    framework = require('@ama-team/voxengine-scenario-framework'),
    scenario = {
        // stripped off for clarity    
    },
    settings = {
        logLevel: sdk.loggers.LogLevel.Info,
        customDataDeserializer: function(customData) {
            try {
                return JSON.parse(customData);
            } catch (e) {
                return {};
            }
        }
    };

framework.run(scenario, settings);
```

After that you just need to set up your bundling machine to produce
single-file script, and you're done. Don't forget to strip the 
comments - VoxImplant restricts scripts bigger than 128kb.

## Diving deeper

While the everything specified above is still true, there are plenty of 
things that should be clarified.

### Conventions

This framework follows several ideas:

- Every lengthy action (transition, abort, staying in particular state)
may be timed out. Scenario may be timed out as well.
- Every failed action means that scenario has failed. The only 
exception is made for failed aborted transitions.
- Every timed out lengthy action may have rescue handler, so it may
save scenario from failure. Rescue handlers are run only in case of
timeout event, in every other case lengthy action must save itself on
it's own.
- Every lengthy action is fed with cancellation token that allows 
action to discover it is cancelled or timed out.
- Every user-defined function (e.g. transition) is fed with current 
scenario execution as `this`.
- While there are timeout defaults, all timeouts are configurable, and
no timeout is hardcoded.
- Promises over listeners.

### State

The state consists of more things than listed in example. Full schema
of state declaration is specified below:

```js
var state = {
    id: 'string', // state id, unique inside stage
    entrypoint: false,
    terminal: false,
    transition: function (previousState, hints, cancellationToken) {
        // accepts current scenario execution as `this` and returns promise
        // that resolves once state is reached
        
        // hints is user-defined object to pass data or help with conditional logic
        
        // cancellationToken is a special object with `isCancelled()` method
        // it allows you to not take some actions if transition has been cancelled
    },
    onTransitionTimeout: function (previousState, hints, cancellationToken, error) {
        // rescue handler in case transition has timed out
    },
    abort: function (previousState, hints, cancellationToken) {
        // triggered if another transition has been started during this one
    },
    onAbortTimeout: function (previousState, hints, cancellationToken, error) {
      
    },
    // values equal to false or lesser than zero are treated as 'no timeout'
    // millisecond is used as time unit
    timeouts: {
        // useful to cancel long dials automatically
        transition: 45 * 1000,
        onTransitionTimeout: 15 * 1000,
        abort: 15 * 1000,
        onAbortTimeout: 3 * 1000,
        onTimeout: 3 * 1000,
        // state timeout
        state: null
    }
};
```

Whenever framework receives call for transition into state X, it calls 
`transition` property and waits for timeout being set. If transition
timeouts, corresponding rescue handler is called. Rescue handler 
returns promise that is treated just as one returned by transition, but
default handler simply passes error through. Both transition and rescue
handler get same `previousState` and `hints` arguments, but 
`cancellationToken` differs.

Transition / rescue handler chain return value is checked for
`transitionedTo` and `trigger` properties. The first one allows to 
override state scenario has reached, the second one allows to trigger
next transition instantly:
 
```js
var full = {
    id: 'initialized',
    transition: function () {
        return Promise.resolve({
            transitionedTo: 'truly-initialized',
            trigger: {
                id: 'terminated',
                hints: {
                    callTookLessThanThirtySeconds: true
                }
            }
        });
    }
};

var shortcuts = {
    id: 'initialized',
    transition: function () {
        return Promise.resolve({
            transitionedTo: 'truly-initialized',
            // sorry, no hints in shortcut
            trigger: 'terminated'
        });
    }
}
```

In case transition / rescue handler chain 
ends up with a rejected promise, the whole scenario is considered 
failed and terminate sequence is launched.

Abort and abort rescue handler pair act in the same way (except for 
result processing), being called whenever new transition is issued 
while current one hasn't ended.

### Scenario

```js
var scenario = {
    id: 'callback', // used for logging only
    version: '0.1.0', // used for logging only
    environment: 'production', // used for logging only
    states: [
        {
            id: 'initialized',
            entrypoint: true
        },
        {
            id: 'terminated',
            terminal: true
        }
    ],
    trigger: TriggerType.Http,
    onTermination: function (hints, cancellationToken) {
        // you may do necessary post-scenario routine here and then resolve returned promise
    },
    onTerminationTimeout: function (hints, cancellationToken, error) {
        // rescue handler
    },
    timeouts: {
        // here you can specify scenario timeouts and state tiemout defaults
        scenario: null,
        onTermination: 15 * 1000,
        onTerminationTimeout: 15 * 1000,
        state: null,
        transition: 45 * 1000,
        onTransitionTimeout: 15 * 1000,
        abort: 15 * 1000,
        onAbortTimeout: 3 * 1000
    }
};
```

Essentially, you may define scenario using only `states` and `trigger` 
properties. Scenario has to have exactly one `entrypoint` state and at 
least one `terminal` state to be successfully validated.

### Execution

Execution is an object that is passed as `this` to all user-defined
actions, which allows to store intermediate data, pass dependency 
injections and call `transitionTo` method:

```js
var execution = {
    data: {}, // put here anything you wish, inteneded to store data between states
    container: {}, // dependency injection container
    arguments: {}, // arguments passed by trigger
    debug: function (message) {
        // logs message, substituting pattern {} with extra arguments
    },
    info: function (message) {},
    warn: function (message) {},
    error: function (message) {},
    transitionTo: function (state, hints) {
        // allows to trigger transitions whenever you need
    }
}
```

### Validation

You should validate your scenario before pushing to VI. This can be
easily done via corresponding call:

```js
var framework = require('@ama-team/voxengine-scenario-framework'),
    scenario = {};

    validationResult = framework.validate(framework.normalize(scenario));
```

validation result looks like this:

```js
var validationResult = {
    valid: true,
    violations: [
        'strings that describe problems'
    ]
}
```

Please note that `valid` property is not the same as `violations`
property emptiness, some reported violations may not convert scenario to
invalid one.

## Concurrency notes

This library is built with run-to-completion model in mind. VoxImplant
engineers confirmed that this model is used by their interpreter.

## Other notes

- Please note that at the moment of this document being written ES6
**had not been supported by VoxImplant**. While you can use transpiler
to transform your scripts to ES5, i personally recommend not to use
ES6 until it is officially supported and write everything in ES5 - it
may save you nerves during debug.
- It is also strongly recommended to strip all comments from framework,
but not to minify it (at least agressively) to simplify debug in case 
something won't work as expected.
- There is also a package `@ama-team/voxengine-definitions` that 
contains jsdoc definitions for VoxEngine internals. Be sure to install 
it if you need autocompletion in IDE other than provided by official 
web UI.
- `@ama-team/voximplant-publisher` is lazily developed and may be 
already released at this moment
- There are plans for automated runner and any testing framework
integration but oh god where do we get such amount of time

## Future plans

- onTimeout state handlers
- Better documentation