/* global jake, complete, fail */

var Path = require('path')

var Support = {
  tasks: function (tasks) {
    return tasks.map(function (task) {
      if (typeof task === 'string' || task instanceof String) {
        task = jake.Task[task]
      }
      return task
    })
  },
  chain: function (tasks, deferErrors) {
    function invoke (task) {
      console.log('Invoking task ' + task.fullName)
      task.invoke.apply(task, arguments)
      return task
    }
    tasks = Support.tasks(tasks)
    var errors = []
    var first = tasks.shift()
    var last = tasks.reduce(function (carrier, task) {
      carrier.addListener('complete', function (value) {
        console.log('Task ' + carrier.fullName + ' completed')
        invoke(task, value)
      })
      carrier.addListener('error', function (e) {
        console.log('Task ' + carrier.fullName + ' failed')
        if (!deferErrors) {
          return fail(e)
        }
        errors.push(e)
        invoke(task)
      })
      return task
    }, first)
    last.addListener('complete', function (value) {
      console.log('Task ' + last.fullName + ' completed')
      if (errors.length === 0) {
        return complete(value)
      }
      fail(errors.pop())
    })
    last.addListener('error', function () {
      console.log('Task ' + last.fullName + ' failed')
      fail()
    })
    first.invoke()
  },
  exec: function (command) {
    if (command.join) {
      command = command.join(' ')
    }
    return new Promise(function (resolve, reject) {
      var exec = jake.exec(command, {printStdout: true, printStderr: true, breakOnError: false}, resolve)
      exec.addListener('error', reject)
    })
  },
  executable: function (name) {
    return Path.resolve(__dirname, '..', '..', 'node_modules', '.bin', name)
  }
}

Support.supersede = function (command) {
  return Support.exec(command).then(complete, setTimeout.bind(global, fail, 0))
}

module.exports = Support
