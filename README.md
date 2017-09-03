# (Unofficial) VoxEngine Scenario Framework

[![npm (scoped)](https://img.shields.io/npm/v/@ama-team/voxengine-scenario-framework.svg?style=flat-square)](https://www.npmjs.com/package/@ama-team/voxengine-scenario-framework)
[![CircleCI/Master](https://img.shields.io/circleci/project/github/ama-team/voxengine-scenario-framework/master.svg?style=flat-square)](https://circleci.com/gh/ama-team/voxengine-scenario-framework/tree/master)
[![Coveralls/Master](https://img.shields.io/coveralls/ama-team/voxengine-scenario-framework/master.svg?style=flat-square)](https://coveralls.io/github/ama-team/voxengine-scenario-framework)
[![Scrutinizer/Master](https://img.shields.io/scrutinizer/g/ama-team/voxengine-scenario-framework/master.svg?style=flat-square)](https://scrutinizer-ci.com/g/ama-team/voxengine-scenario-framework?branch=master)
[![Code Climate](https://img.shields.io/codeclimate/github/ama-team/voxengine-scenario-framework.svg?style=flat-square)](https://codeclimate.com/github/ama-team/voxengine-scenario-framework)

This repository contains a framework which takes opinionated approach
to handling VoxEngine scenarios. It takes care of different states,
transitions between them, data saving and logging.

To install this framework, simply run following command:

```
npm i @ama-team/voxengine-scenario-framework -S
```

Please note that framework uses [@ama-team/voxengine-sdk][] under the
hood, which may solve some other low-level problems for you.

## What's the problem?

Scenarios are complex and usually quite asynchronous things. Developing
them the usual way usually results in ton of spaghetti code and unclear
conditions hidden here and there, as well as no specific ordering
on certain events that have to be ordered (for example, you can't emit
more than one HTTP request after `VoxEngine.terminate()`). Promises
are partial response to it, but it easily becomes as ugly when 
unnecessary conditions come into play - e.g. you need to terminate the
callback scenario when both calls are finished, but there is a chance
that second call won't be made, so you need to take this into account
and either create humongous control conditions or resolving promises 
that didn't actually resolve.

We need something stronger.

## State model

We can break down each scenario into set of states. Imagine the 
simplest scenario fo notifying clients by call:

1. Target phone number called
2. Call failed, go to #4
3. Call succeeded, say the phrase then go to #4
4. Report to HTTP backend and terminate

It can be easily represented as in code:

```js
var Framework = require('@ama-team/voxengine-scenario-framework')

var scenario = {
  trigger: Framework.TriggerType.Http,
  states: {
    entrypoint: {
      entrypoint: true,
      transition: function () {
        var number = this.arguments.number
        this.state.call = VoxEngine.callPSTN(number)
      }
    },
    failed: {
      transition: function () {
        this.state.success = false
      },
      triggers: {
        id: 'terminated'
      }
    },
    connected: {
      transition: function () {
        return new Promise(function (resolve) {
          var call = VoxEngine.callPSTN(number)
          this.state.call = call
          call.addEventListener(CallEvents.Connected, function () {
            resolve({trigger: 'communicated'})
          })
          call.addEventListener(CallEvents.Failed, function () {
            this.state.success = false
            resolve({transitionedTo: 'failed'})
          })
        })
        var phrase = this.arguments.phrase
        
        return new Promise(function (resolve, reject) {
          this.state.call.say(phrase, Language.US_ENGLISH_FEMALE)
          this.state.call.addEventListener(CallEvents.PlaybackFinished, function() {
            this.state.success = true
            resolve({trigger: 'terminated'})
          })
        })
      }
    },
    communicated: {
      transition: function() {
        return new Promise(function (resolve) {
          this.state.call.say(phrase, Language.US_ENGLISH_FEMALE)
          this.state.call.addEventListener(CallEvents.PlaybackFinished, function() {
            this.state.call.hangup()
            this.state.success = true
            resolve()
          })
        })
      },
      triggers: {
        id: 'terminated'
      }
    },
    terminated: {
      terminal: true,
      transition: function () {
        var options = new Net.HttpRequestOptions()
        options.postData = JSON.stringify({success: this.state.success})
        return Net.httpRequestAsync('http://some-backend', options)
      }
    }
  }
}
```

While this scenario is more complex as if all this logic has been 
written in straightforward way, it shows how another approach looks
like. Now you have explicit states and transitions that are required
to travel from one state to another; each transition may tell engine
that it ended not so well, resulting in a completely another state.
The scenario itself now boils only to crucial points (states) and
possible outcomes during a transition. Beside that, framework also
helps in passing arguments inside scenario and cornering some sharp 
edges. So, let's inspect what we have here.

## Scenario schema

*this section contains examples in YAML rather than in javascript 
for higher readability*

First of all, scenario has three auxiliary properties describing 
itself. They are completely optional, but will save you a lot of 
debugging time.

```yml
id: <string, optional>
version: <string, optional>
environment: <string, optional>
```

Then there is states structure:

```yml
states:
  <name:string>:
    entrypoint: <boolean, optional>
    terminal: <boolean, optional>
    transition: <handler>
    abort: <handler, optional>
    triggers: # optional
      id: <state name:string>
      hints: <object/function, optional>
```

Scenario has to have exactly one entrypoint state and at least one
terminal state - otherwise it won't be launched.

And metadata/metaprocessing section:

```yml
# whether the scenario is launched by http call or phone call
trigger: <Framework.TriggerType>
# default arguments
arguments: <object, optional>
# default context state, doesn't relate to states discussed above
state: <object, optional>
onTermination: <handler, optional>
onError: <handler, optional>
# used to deserialize arguments from custom data
deserializer: <handler, optional>
timeouts: <object<string, int/null>
```

Handler is a slightly complex structure:

```yml
handler: <function>
timeout: <int/null, optional>
onTimeout:
  handler: <function>
  timeout: <int/null, optional>
```

However, you can always specify it just as a function, and engine will
simply expand it.

## Passing data between states

In lots of scenarios you will need to pass some data around and/or know
previous state from which engine is transitioning. Transition function
interface accepts three arguments:

```js
function transition (previousStateId, hints, cancellationToken) {}
``` 

First argument will contain the name of previous state. Hints is an
that may contain any data you want, and you may set whenever you 
trigger some state:

```js
var states = {
  preterminal: {
    transition: function () {
      return {trigger: {id: 'terminal', hints: {sendDebugInfo: true}}}
    }
  },
  terminal: {
    transition: function (previous, hints) {
      if (hints.sendDebugInfo) {
        // Do something
      }
    }
  }
}
```

```js
var states = {
  preterminal: {
    triggers: {
      id: 'terminal',
      hints: {sendDebugInfo: true}
    }
  }
}
```

Moreover, hints may be a function that will be called in the same 
context in the moment of trigger processing.

The third argument is an advanced aspect discussed later.

## The context

All user-supplied code is executed inside the context - that means that
same specific object will be passed as `this`. This object has 
following properties:

```yml
arguments: <object>
state: <object>
transitionTo: <function<string, hints>>
trace: <function<message, ...replacements>>
debug: <function<message, ...replacements>>
info: <function<message, ...replacements>>
notice: <function<message, ...replacements>>
warn: <function<message, ...replacements>>
error: <function<message, ...replacements>>
```

Logger methods are forwarded to Slf4j-alike logger from 
[@ama-team/voxengine-sdk][]. It has a nice feature of resolving
`{}` placeholders into arguments, so 
```js
this.warn('{} has jumped over {}', 'quick fox', 'lazy dog')
````

Will result in a phrase you've seen a thousand times. 

## Non-triggering states / coding outside of the box

Basically, the term state itself doesn't imply that there is any kind
immediate transition to another state. In case transition doesn't
return the `{trigger: something}` structure and there is no `.triggers`
property on the state, the framework will state in specific state until
something calls the `.transitionTo` method on context:

```js
var state = {
  transition: function () {
    var trigger = this.transitionTo.bind(this, {trigger: 'terminated'})
    this.state.call.addEventListener(CallEvents.Disconnected, trigger)
  }
}
```

This also means scenario may hang near-infinite in some state until 
VoxEngine kicks whole scenario out, so be careful playing with this.

If `.transitionTo()` is called during another transition, previous 
transition gets aborted: it's abort handler is called, and it's 
cancellation token (third argument) gets cancelled. Because there is no 
direct way to abort running code, transition that may be abort should 
regularly check if token has been cancelled (`token.isCancelled()`) 
before proceeding further:

```js
var httpCallsMadeState = function (p, h, token) {
  var valueA = client.performRequest()
  return client
    .performRequest('/ping')
    .then(function () {
      return token.isCancelled() ? null : client.performRequest('/pong')
    })
}
```

## Arguments

Scenarios (at least HTTP-triggered) usually need arguments to run.
This framework allows to specify some hardcoded arguments and to 
deserialize them from customData using the `.deserializer` scenario
property. Framework will tak hardcoded arguments, apply deserializer
on customData (either VoxEngine.customData or call.customData, 
depending on scenario trigger type), and then recursively merge them.
Please note that if deserializer fails (throws error or returns 
rejected thenable), the whole scenario will be aborted.

By default, framework will try to decode JSON out of customData and
silently proceed on fail.

## Timeouts

Every lengthy action should have a timeout to prevent infinite hangs.
There are two options that control it: individual timeout settings on
handlers and scenario-wide default values (specified in `.timeouts` 
property):

```js
var scenario = {
  states: {
    entrypoint: {
      transition: {
        // timeout of 20 will be used
        handler: function () {},
        onTimeout: {
          // timeout of 20 will be used because of override
          handler: function () {},
          timeout: 20
        }
      }
    }
  },
  timeouts: {
    transition: 20,
    onTransitionTimeout: 10
  }
}
```
 
Timeouts are set in milliseconds, every value but number >=
0 is treated as a 'no timeout'.

In case of timeout cancellation token is cancelled as well.

## Terminating

Usually there is some kind of post-scenario things to be done, like 
waiting for all background HTTP requests or printing results to log.
For tasks like that you can specify a termination handler in scenario:

```js
var scenario = {
  onTermination: function () {
    return awaitSomething()
  }
}
```

Termination handler acts the very same as other handlers, but receives
`TInitializationStageResult` and `TScenarioStageResult` as arguments.

Framework will call VoxEngine.terminate after everything has been done,
so it's not necessary to do it manually.

## Errors and error handling

There are several places when error may be thrown:

- Argument deserializer. In that case termination handler will be
called instantly and scenario won't be executed.
- Active transition. This will cause `scenario.onError` handler to be 
triggered, and, if it doesn't respond with 
`{trigger: some other state}`, halt the scenario with an error,
still calling `scenario.onTermination` handler.
- Termination handler. This will do nothing but halt it as javascript
does with every piece of code throwing an exception.
- And, finally, the framework itself. This will cause piece of code to
end with `Tripped` status, so watch for these to report.

The onError handler signature is simple:

```js
var onError = function (error, previousState, targetState, hints) {}
``` 

onError may take some time to figure out what to do and may return a 
promise, as any other handler, as well as be timed out. 

## Logging

Framework logs everything it can, which is usually not what you really
want. However, the logger is taken from [@ama-team/voxengine-sdk][] and
is controlled accordingly:

```js
var SDK = require('@ama-team/voxengine-sdk')
var Logger = SDK.Logger
var Slf4j = Logger.Slf4j

// decreasing overall verbosity
Slf4j.setLevel(Logger.Level.Warn)
// increasing scenario log verbosity
Slf4j.setLevel('ama-team.vsf.context', Logger.Level.Debug)
```

By default, all INFO and higher level messages are logged.

## Validation

To prevent invalid scenario from uploading, you may validate it first.
To do so, just run `Framework.validate` to receive a `ValidationSet`
object. If it's severity is 
`Framework.Schema.Validator.Severity.Fatal`, scenario is invalid and 
can't be used.

## Concurrency notes

This library is built with run-to-completion model in mind. VoxImplant
engineers confirmed that this model is used by their interpreter.

## Other notes

- **Do not use VoxEngine.easyProcess.** It will terminate scenario 
prematurely, as it 
[binds onto VoxEngine.terminate](http://voximplant.com/help/faq/what-code-is-behind-voxengine-easyprocess-function/).
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
- `@ama-team/voximplant-publisher` *should* be finished someday.

## Dev branch state

[![CircleCI/Dev](https://img.shields.io/circleci/project/github/ama-team/voxengine-scenario-framework/dev.svg?style=flat-square)](https://circleci.com/gh/ama-team/voxengine-scenario-framework/tree/dev)
[![Coveralls/Dev](https://img.shields.io/coveralls/ama-team/voxengine-scenario-framework/dev.svg?style=flat-square)](https://coveralls.io/github/ama-team/voxengine-scenario-framework)
[![Scrutinizer/Dev](https://img.shields.io/scrutinizer/g/ama-team/voxengine-scenario-framework/dev.svg?style=flat-square)](https://scrutinizer-ci.com/g/ama-team/voxengine-scenario-framework?branch=dev)

  [@ama-team/voxengine-sdk]: https://npmjs.org/package/@ama-team/voxengine-sdk