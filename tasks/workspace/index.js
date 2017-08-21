var Path = require('path')

var root = Path.resolve(__dirname, '..', '..')
var tmpDirectory = Path.resolve(root, 'tmp')
var metadataDirectory = Path.resolve(tmpDirectory, 'metadata')
var reportDirectory = Path.resolve(tmpDirectory, 'report')
var testDirectory = Path.resolve(root, 'test')
var testSupportDirectory = Path.resolve(testDirectory, 'support')
var testSuitesDirectory = Path.resolve(testDirectory, 'suites')

var paths = function (name) {
  return {
    metadata: Path.resolve(metadataDirectory, name),
    report: Path.resolve(reportDirectory, name)
  }
}

var Workspace = {
  suites: ['unit', 'integration', 'acceptance'],
  paths: {
    report: reportDirectory,
    metadata: metadataDirectory,
    allure: paths('allure'),
    coverage: paths('coverage'),
    junit: paths('junit'),
    xunit: paths('xunit'),
    support: testSupportDirectory,
    test: {
      toString: function () {
        return testDirectory
      },
      self: testDirectory,
      support: testSupportDirectory,
      suites: testSuitesDirectory
    }
  }
}

module.exports = Workspace
