# (Unofficial) VoxEngine Scenario Framework

This repository is dedicated for a simple framework that runs VoxEngine
scenarios.

## Diving in

This framework represents scenario as a set of states, only one of which
can be active in any moment, with transitions - and transition here 
means a piece of code that would enforce that state (more precise,
transition is a function that receives current scenario run as this and
returns `Promise` which will be resolved once state is achieved). When
scenario is loaded, framework determines entrypoint state, transitions 
to it (i.e. executes transition function and waits for `Promise` 
resolve), and continues traversing states until final state is reached, 
and then terminates scenario.

Every state contains `.transition(previousState, hints)` method, and,
optionally `.abort(overridingState, hints)` method, both of which have 
to return successfully resolving promises (if `.abort()` promise 
rejects, it is simply logged, while `.transition()` promise reject is 
considered scenario fail and causes termination). While `.transition()`
method performs actions required to bring scenario into target state,
`.abort()` is used when it is required to abort unfinished transaction.
Current scenario run is accessible as `this` for both `.transition()` 
and `.abort()`, and `hints` is a (mostly) user-defined object that can
contain additional hints about how transition should occur.

State transition consists of state's `.transition()` method execution, 
and it may be invoked in two ways:

- If previous transition has returned object with `trigger` property,
transition for state that was described in `trigger` object would be 
invoked. That makes easy to make straightforward scenarios that just 
progress through.
- If current scenario run receives `.transitionTo` call with object,
identifying next state. This may be useful to trigger states based on 
callbacks.

Because of scenario complexity, it is possible that second transition 
may start while first one hasn't ended. In that case framework will 
execute `.abort()` method of state of first transition, and invoke 
second transition without waiting for `.abort()` to finish.

Some parts of this may sound like good old FSM, but it's formally quite 
far from one.

## Example

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

framework.prepare(scenario).run();
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
- Termination sequence itself consists of executing `onTermination`
function and waiting for promise to resolve (you may want to log some
data or wait for HTTP requests to finish), then, finally,
calling `VoxEngine.terminate()`.

Logic is a little bit more complex (e.g. there are arguments in 
`transition()` function, simultaneous transitions, abort process, 
chained transitions), but those details are written out in
[Schema](#schema) section.

Please note that until version 1.0.0 all minor versions
**probably would** break backward compatibility (so they are, actually,
'pre-stable major versions') and text above may change from version to
version. I'll try to keep API as stable as possible.

## Schema

### ScenarioDeclaration

Scenario declaration simply states facts about scenario, such as name,
version, timeouts and states that scenario may come into.

```js
{
    name: 'callback', // optional
    version: '0.1.0', // optional as well,
    environment: <anything>, // optional, used for logging, so you'll want to set it to staging/production/etc.
    states: [], // see below
    onTermination: function () {}, // function that will be called before termination, optional
    trigger: 'Call', // or 'Http', mandatory.
    timeouts: {
        onTermination: 60000,
        transition: 10000, // default transition timeout, may be overriden per-state
        abort: 10000, // default aboty timeout, may be overriden per-state
        state: 60000, // default state timeout, may be overriden per-state
    }
}
```

Scenario will be automatically validated before each run, so if you set 
something wrong, validator will simply shout at you. To prevent 
happening this at runtime, you may validate your scenarios locally 
before pushing them, see [Validation](#validation) section.

### StateDeclaration

State represents single state scenario may transition into.

```js
{
    name: 'initialized',
    stage: 'initialization,
    transition: function (previousState, hints, cancellationToken) {},
    abort: function (overridingState, hints) {}, // optional, but recommended
    entrypoint: false, // whether is first state in scenario
    terminal: false, // whether scenario should be shut down after reaching that state

    // if this is set and state timeout is reached, this function may
    // return <TriggerDeclaration> that will enforce state transition
    // instead of immediate termination
    onTimeout: function () {},
    timeouts: {
        transition: 10000, // how long may transition last, 0 or less for unlimited wait
        abort: 10000, // same for abort
        self: -1 // how many time scenario is allowed to stay in this state?
    }
}
```

### TriggerDeclaration

Explains to framework what to trigger next

```js
{
    name: '<state name>',
    stage: '<stage id>',
    hints: <user-defined object>
}
```

### TransitionResult

Transition result is a structure returned by transition promise

```js
{
    transitionedTo: {
        name: '<state name>',
        stage: '<stage id>'
    },
    trigger: <TriggerDeclaration>
}
```

If `.transitionedTo` is set, it is used to determine current state 
(instead of using state whose `.transition()` was called).

If `.trigger` is set, framework instantly triggers next transition.

### ScenarioRun

TBD

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

Please note that `valid` property is not the same as `violations`
property emptiness, some reported violations may not convert scenario to
invalid one.

## Timeouts

As you may have seen though the document, nearly every action has a 
configurable timeout. Since hand-generated promises are used 
extensively, it is terribly easy to leave unresolvable promise behind
that would prevent scenario from successful completion and may drain
your money. Because of that framework enforces timing constraints on
most of tasks, leaving you an option to configure them more precisely.

## Concurrency notes

TBD

## Other notes

- Please note that at the moment of this document being written ES6
**had not been supported by VoxImplant**. While you can use transpiler
to transform your scripts to ES5, i personally recommended not to use
ES6 until it is officially supported and write everything in ES5 - it
may save you nerves during debug.
- We have a package `@ama-team/voxengine-references` that contains jsdoc
definitions for VoxEngine internals. Be sure to install it if you need
autocompletion in IDE other than provided by official web UI.
- Check `@ama-team/voximplant-publisher` as well
- We have plans for automated runner and any testing framework
integration but oh god where do we get such amount of time