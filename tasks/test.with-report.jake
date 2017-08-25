var Support = require('./support')
var Workspace = require('./workspace')

namespace('test', function () {
  task('with-report', {async: true}, function () {
    Support.chain(['test:clean', 'test:coverage', 'test:report'], true)
  })

  Workspace.suites.forEach(function (suite) {
    namespace(suite, function () {
      task('with-report', function () {
        var tasks = ['test:' + suite + ':coverage', 'test:report']
        Support.chain(tasks, true)
      })
    })
  })
})
