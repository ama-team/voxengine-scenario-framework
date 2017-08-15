var Support = require('./support')
var Workspace = require('./workspace')
var Path = require('path')
var Mocha = require('mocha')
var glob = require('glob')

namespace('test', function () {
  Workspace.suites.forEach(function (suite) {
    task(suite, {async: true}, function (pattern) {
      var options = {
        reporter: 'mocha-multi-reporters',
        reporterOptions: {
          reporterEnabled: 'spec, xunit, mocha-junit-reporter, mocha-allure-reporter',
          mochaAllureReporterReporterOptions: {
            targetDir: Path.resolve(Workspace.paths.allure.metadata, suite)
          },
          xunitReporterOptions: {
            output: Path.resolve(Workspace.paths.xunit.metadata, suite, 'xunit.xml')
          },
          mochaJunitReporterReporterOptions: {
            mochaFile: Path.resolve(Workspace.paths.junit.metadata, suite, 'TEST-' + suite + '.xml')
          }
        },
        slow: 10,
        timeout: 200
      }
      var suiteDirectory = Path.resolve(Workspace.paths.test.suites, suite)
      if (pattern) {
        options['grep'] = new RegExp(pattern, 'i')
      }
      glob(Path.resolve(suiteDirectory, '**', '*.spec.js'), function (error, files) {
        if (error) {
          return fail(error)
        }
        var mocha = new Mocha(options)
        mocha.addFile(Path.resolve(Workspace.paths.test.support, 'setup.js'))
        mocha.addFile(Path.resolve(suiteDirectory, 'setup.js'))
        for (var i = 0; i < files.length; i++) {
          mocha.addFile(files[i])
        }
        mocha.run(function (failures) {
          failures === 0 ? complete(0) : fail(failures)
        })
      })
    })

    namespace(suite, function () {
      task('coverage', {async: true}, function () {
        var command = [
          Support.executable('istanbul'),
          'cover',
          '--dir',
          Path.resolve(Workspace.paths.coverage.metadata, suite),
          '--report',
          'none',
          Support.executable('jake'),
          'test:' + suite
        ];
        Support.supersede(command)
      })
    })
  })
})

task('test', {async: true}, function () {
  var tasks = Workspace.suites.map(function (suite) {
    return 'test:' + suite
  })
  Support.chain(tasks)
})
