# (Unofficial) VoxEngine Scenario Framework

This repository is dedicated for a simple framework that runs VoxEngine
scenarios.

## Conventions

This framework represents scenario as a set of states, only one of which
can be active in any moment, with transitions between states. 

This is somewhat related to FSM, but far from things you're thinking
about:

- There are no constraints on which state transitions: each state may 
transition into other one, except for final states. This is a trade-off
(each transition has to implement conditional logic in case it has state
may be transitioned to from multiple points), but i couldn't come with
anything better that wouldn't provide fierce burst of transition
handling code or 'no transition defined for state X -> state Y' errors
in runtime.
- Scenario transitions are written right into states (i.e. "execute
this code to transition in me"), and those transitions are not
side-effect free, as well as rules for those transitions may be
non-deterministic.

Let's come up with a simple example:

```js
var framework = require('@ama-team/voxengine-scenario-framework'),
    scenario = {
        states: [
            {
                name: 'calleeDataFetched',
                entrypoint: true,
                transition: function () {
                    // wrapping http request in promise
                    return new Promise(...)
                        .then(function (data) { this.data.callee = data.callee })
                        // force transition to another state as soon as this one was reached
                        .then(function (_) { return { trigger: { name: 'called' } } });
                }
            },
            {
                name: 'called',
                transition: function () {
                    return new Promise(function (reject, resolve) {
                            this.data.call = VoxEngine.callPSTN(this.data.callee);
                            this.data.call.addEventListener(CallEvents.Connected, function () { resolve(); });
                            // termination sequence will be started in case any transition rejects,
                            // so be careful
                            this.data.call.addEventListener(CallEvents.Failed, function () { reject(); });
                            this.data.call.addEventListener(CallEvents.Finished, function () { transitionTo({ name: 'recorded' }); });
                        })
                        // `trigger` omitted - scenario will hang at this moment
                        // until someone will call transitionTo() method
                        .then(function (_) { return {} });
                }
            },
            {
                name: 'recorded',
                final: true, // termination sequence will be triggered when this state is reached
                transition: function () {
                    // wrapping another HTTP request
                    return new Promise(...);
                }
            }
        ],
        trigger: framework.TriggerType.Http
    };

framework.run(scenario);
```

While it's obviously huge in term of lines, it's still simple and
consists of three states:

- Number to call has been successfully fetched
- Person has been successfully dialed
- After call has finished, it's result has been recorded

Every state transition is a promise. Framework doesn't know what's 
handled inside, but it knows that once promise resolved, it is safe
to switch current state, and if it got rejected, it means that some 
unhandleable error has happened, and script has to terminate. We will 
return to this in a second.

The first one is marked as entrypoint, which means that when scenario is 
started, it will transition to it. Of course, there may be only one 
entrypoint.

The third one is marked as final. This means that if this state is 
reached, framework will start termination sequence, and whole scenario
has de-facto ended by that moment.

So, in simplistic way scenario executes like this:

- Initialize framework
- Catch CallAlerting event in case scenario is call-triggered
- Call `.transition()` on state with `entrypoint` flag set to `true` 
(`calleeDataFetched`) and receive a promise
- Set state to `calleeDataFetched` once promise has resolved, or start 
termination sequence if it has been rejected
- Analyze promise output and read instruction for triggering `called` 
transition
- Repeat `.transition()` call step
- Analyze promise output and take no action since there is no trigger 
instruction
- Start next transition to `recorded` on `transitionTo()` call specified 
in event
- When promise resolves, understand that state is marked as final and
trigger termination sequence
- Termination sequence itself consists of waiting for termination hooks,
which are promises that have to resolve (e.g. you may want to wait until 
all HTTP requests complete), then executing `onTermination` function and 
waiting for promise to resolve (you may want to record/print out 
scenario duration), then, finally, calling `VoxEngine.terminate()`.

Logic is a little bit more complex (e.g. there are arguments in 
`transition()` function, simultaneous transitions, abort process, 
chained transitions), but those details are written out in
[Schema](#schema) section.

Please note that until version 1.0.0 all minor versions
**probably would** break backward compatibility (so they are, actually,
'pre-stable major versions') and text above may change from version to
version. I'll try to keep API as stable as possible.

## Usage

## Schema

### Scenario

```js
{
    name: 'callback', // optional
    version: '0.1.0', // optional as well,
    environment: <anything>, // optional, used for logging, so you'll want to set it to staging/production/etc.
    states: [], // see below
    entrypoint: {
        name: '<state name>', // mandatory
        stage: '<stage id>' // optional, see below
    }
    terminationHooks: [], // list of promises required for scenario to finish, optional
    onTermination: function () {}, // function that will be called before termination, optional
    trigger: 'Call', // or 'Http', mandatory.
    timeouts: {
        onTermination: 60000,
        terminationHooks: 60000,
        transition: 10000, // default transition timeout, may be overriden per-state
        state: 60000, // default state timeout, may be overriden per-state
    }
}
```

### State


```js
{
    name: 'initialized',
    stage: 'initialization,
    transition: function (previousState, hints, cancellationToken) {},
    abort: function (overridingState, hints) {},
    onTimeout: function() {},
    entrypoint: false,
    terminal: false,
    timeouts: {
        transition: 10000,
        abort: 10000,
        self: -1
    }
}
```

### TransitionResult

```js
{
    transitionedTo: {
        name: '<state name>',
        stage: '<stage id>'
    },
    trigger: {
        name: '<state name>',
        stage: '<stage id>',
        hints: <user-defined object>
    }
}
```

## Validation

You should validate your scenario before pushing to VI. This can be
easily done via corresponding call:

```js
var framework = require('@ama-team/voxengine-scenario-framework'),
    scenario = ...

    validationResult = framework.validate(scenario);
```

validation result looks like this:
```js
{
    valid: true,
    violations: [
        'strings that describe problems'
    ]
}
```

## Concurrency notes

TBD

## Other notes

- We have a package `@ama-team/voxengine-reference` that contains jsdoc
definitions for VoxEngine internals. Be sure to install it if you need
autocompletion in other than official web UI IDE.
- Check `@ama-team/voximplant-publisher` as well
- We have plans for automated runner and any testing framework
integration but oh god where do we get such amount of time