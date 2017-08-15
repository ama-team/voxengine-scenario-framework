var Support = require('./support')

namespace('lint', function () {
  task('standard', {async: true}, function () {
    Support.supersede(Support.executable('standard'))
  })
})

task('lint', {async: true}, function () {
  var task = jake.Task['lint:standard']
  task.addListener('complete', complete)
  task.addListener('error', fail)
  task.invoke()
})
