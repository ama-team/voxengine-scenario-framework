var Support = require('./support')
var Path = require('path')
var Mocha = require('mocha')
var glob = require('glob')

var root = Path.resolve(__dirname, '..')
var binDirectory = Path.resolve(root, 'node_modules', '.bin')
var tmpDirectory = Path.resolve(root, 'tmp')
var metadataDirectory = Path.resolve(tmpDirectory, 'metadata')
var coverageMetadataDirectory = Path.resolve(metadataDirectory, 'coverage')
var allureMetadataDirectory = Path.resolve(metadataDirectory, 'allure')
var junitMetadataDirectory = Path.resolve(metadataDirectory, 'junit')
var xunitMetadataDirectory = Path.resolve(metadataDirectory, 'xunit')
var reportDirectory = Path.resolve(tmpDirectory, 'report')
var coverageReportDirectory = Path.resolve(reportDirectory, 'coverage')
var allureReportDirectory = Path.resolve(reportDirectory, 'allure')
var suitesDirectory = Path.resolve(root, 'test', 'suites')
var supportDirectory = Path.resolve(root, 'test', 'support')

var suites = ['unit', 'integration']

function executable (name) {
  return Path.resolve(binDirectory, name)
}

namespace('test', function () {
  suites.forEach(function (suite) {
    task(suite, {async: true}, function (pattern) {
      var mocha = new Mocha()
      var suiteDirectory = Path.resolve(suitesDirectory, suite)
      mocha.addFile(Path.resolve(supportDirectory, 'setup.js'))
      mocha.addFile(Path.resolve(suiteDirectory, 'setup.js'))
      if (pattern) {
        mocha.grep(pattern)
      }
      mocha.reporter('mocha-multi-reporters', {
        reporterEnabled: 'spec, xunit, mocha-junit-reporter, mocha-allure-reporter',
          mochaAllureReporterReporterOptions: {
          targetDir: Path.resolve(allureMetadataDirectory, suite)
        },
        xunitReporterOptions: {
          output: Path.resolve(xunitMetadataDirectory, suite + 'xunit.xml')
        },
        mochaJunitReporterReporterOptions: {
          mochaFile: Path.resolve(junitMetadataDirectory, 'junit', suite, 'TEST-' + suite + '.xml')
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
          executable('istanbul'),
          'cover',
          executable('jake'),
          'test:' + suite
        ];
        Support.supersede(command)
      })
    })
  })

  task('coverage', {async: true}, function () {
    var tasks = suites.map(function (suite) {
      return 'test:' + suite + ':coverage'
    })
    Support.chain(tasks)
  })

  namespace('report', function () {
    task('allure', {async: true}, function () {
      var command = [
        'allure',
        'generate',
        'clean',
        '-o',
        allureReportDirectory,
        '--',
        Path.resolve(allureMetadataDirectory, '**')
      ]
      Support.supersede(command)
    })

    var coverageFormats = {
      lcov: 'lcovonly',
      html: 'html'
    }
    namespace('coverage', function () {
      Object.keys(coverageFormats).forEach(function (type) {
        task(type, {async: true}, function () {
          var command = [
            executable('istanbul'),
            'report',
            '--root',
            coverageMetadataDirectory,
            '--dir',
            Path.resolve(coverageReportDirectory, type),
            coverageFormats[type]
          ]
          Support.supersede(command)
        })
      })
    })

    task('coverage', {async: true}, function () {
      var tasks = Object.keys(coverageFormats).map(function (format) {
        return 'test:report:coverage:' + format
      })
      Support.chain(tasks)
    })
  })

  task('report', {async: true}, function () {
    var tasks = ['coverage', 'allure'].map(function (task) {
      return 'test:report:' + task
    })
    Support.chain(tasks)
  })

  task('with-report', {async: true}, function () {
    Support.chain(['test:coverage', 'test:report'], true)
  })
})

task('test', {async: true}, function () {
  var tasks = suites.map(function (suite) {
    return 'test:' + suite
  })
  Support.chain(tasks)
})
