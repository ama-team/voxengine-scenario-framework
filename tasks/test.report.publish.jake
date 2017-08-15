var Support = require('./support')

namespace('test', function () {
  namespace('report', function () {
    task('publish', {async: true}, function () {
      Support.chain(['test:report:coverage:publish'])
    })
  })
})
