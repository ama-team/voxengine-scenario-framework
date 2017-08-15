var Support = require('./support')
var Workspace = require('./workspace')
var Path = require('path')

namespace('test', function () {
  namespace('report', function () {
    var coverageFormats = {
      lcov: 'lcovonly',
      html: 'html'
    }

    namespace('coverage', function () {
      Object.keys(coverageFormats).forEach(function (type) {
        task(type, {async: true}, function () {
          var command = [
            Support.executable('istanbul'),
            'report',
            '--root',
            Workspace.paths.coverage.metadata,
            '--dir',
            Path.resolve(Workspace.paths.coverage.report, type),
            coverageFormats[type]
          ]
          Support.supersede(command)
        })
      })

      task('publish', function () {
        var command = [
          'cat',
          Path.resolve(Workspace.paths.coverage.report, 'lcov', 'lcov.info'),
          '|',
          Support.executable('coveralls')
        ]
        Support.supersede(command)
      })
    })

    task('coverage', {async: true}, function () {
      var tasks = Object.keys(coverageFormats).map(function (format) {
        return 'test:report:coverage:' + format
      })
      Support.chain(tasks)
    })
  })
})
