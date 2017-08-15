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
    tasks = Support.tasks(tasks)
    var errors = []
    var last = tasks.reduce(function (carrier, task) {
      if (carrier) {
        carrier.addListener('complete', task.invoke)
        carrier.addListener('error', function (e) {
          if (!deferErrors) {
            return fail(e)
          }
          errors.push(e)
          task.invoke()
        })
      }
      return task
    }, null)
    last.addListener('complete', function (value) {
      if (errors.length === 0) {
        return complete(value)
      }
      fail(errors.pop())
    })
    last.addListener('error', fail)
    tasks[0].invoke()
  },
  exec: function (command) {
    if (command.join) {
      command = command.join(' ')
    }
    return new Promise(function (resolve, reject) {
      var exec = jake.exec(command, {printStdout: true, printStderr: true, breakOnError: false})
      exec.addListener('complete', resolve)
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
