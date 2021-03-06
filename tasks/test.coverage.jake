var Support = require('./support')
var Workspace = require('./workspace')

namespace('test', function () {
  task('coverage', {async: true}, function () {
    var tasks = Workspace.suites.map(function (suite) {
      return 'test:' + suite + ':coverage'
    })
    tasks.unshift('test:clean')
    Support.chain(tasks)
  })
})
