var Support = require('./support')

namespace('test', function () {
  task('with-report', {async: true}, function () {
    Support.chain(['test:coverage', 'test:report'], true)
  })
})
