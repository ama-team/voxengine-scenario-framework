# Internals

## Architecture in two minutes

There are several entities in project:

- Scenario: a tree graph of states that transition on into another.
- Execution: object representing current scenario execution, contains
scenario itself, runtime, state-machine, dealas with launching state 
machine and executing things not related to states (e.g. termination 
handler)
- ExecutionRuntime: an object that is supplied as 'this' to state 
transitions - basically this is just a sack of properties and helper 
methods.
- State machine is a class that diverged from execution and is 
basically a state scheduler. Execution had started to bloat up, so i've
decided to separate those concerns.
- Normalizer takes in scenario and tries to bring it in most 
schema-compliant way, wrapping everything in promises, filling missed
things, etc.
- Validator validates that scenario is compliant with schema nd is 
runnable.
- Utility modules supply boring helper functions, concurrent module is 
a little bit, and i don't fully understand how some things have ended 
there D:
