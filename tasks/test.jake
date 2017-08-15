var Support = require('./support')
var Workspace = require('./workspace')
var Path = require('path')
var Mocha = require('mocha')
var glob = require('glob')

namespace('test', function () {
  Workspace.suites.forEach(function (suite) {
    task(suite, {async: true}, function (pattern) {
      var mocha = new Mocha()
      var suiteDirectory = Path.resolve(Workspace.paths.test.suites, suite)
      mocha.addFile(Path.resolve(Workspace.paths.test.support, 'setup.js'))
      mocha.addFile(Path.resolve(suiteDirectory, 'setup.js'))
      if (pattern) {
        mocha.grep(pattern)
      }
      mocha.reporter('mocha-multi-reporters', {
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
      })
      glob(Path.resolve(suiteDirectory, '**', '*.spec.js'), function (error, files) {
        if (error) {
          return fail(error)
        }
        files.forEach(mocha.addFile.bind(mocha))
        mocha.run(function (failures) {
          failures > 0 ? fail() : complete()
        })
      })
    })

    namespace(suite, function () {
      task('coverage', {async: true}, function () {
        var command = [
          Support.executable('istanbul'),
          'cover',
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
