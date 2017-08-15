var Support = require('./support')

namespace('test', function () {
  task('report', {async: true}, function () {
    var tasks = ['coverage', 'allure'].map(function (task) {
      return 'test:report:' + task
    })
    Support.chain(tasks, true)
  })
})
