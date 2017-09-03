# Schema

## 0.2

```yaml
id: <string, optional>
name: <string, optional>
description: <string, optional>
type: <TriggerType>
setup:
  customData: <string, optional>
  log: <string, optional>
scenario: <TScenarioInput>
assertions:
  result:
    status: <OperationStatus, optional>
    stages:
      initialization:
        status: <OperationStatus, optional>
        log: <string, optional>
      scenario:
        status: <OperationStatus, optional>
      termination:
        value: <*, optional>
        status: <OperationStatus, optional>
  handlers:
    state:
      <id>:
        <transition|abort|transition.onTimeout|abort.onTimeout>:
          count: <integer>
          calls: 
            - [<...arguments>]
    onError:
      count: <integer>
      calls: 
        - [<...arguments>]
    onTermination:
      count: <integer>
      calls: 
        - [<...arguments>]
```