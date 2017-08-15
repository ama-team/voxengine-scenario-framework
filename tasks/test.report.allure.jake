var Support = require('./support')
var Workspace = require('./workspace')
var Path = require('path')

namespace('test', function () {
  namespace('report', function () {
    task('allure', {async: true}, function () {
      var command = [
        'allure',
        'generate',
        '--clean',
        '-o',
        Workspace.paths.allure.report,
        '--',
        Path.resolve(Workspace.paths.allure.metadata, '**')
      ]
      Support.supersede(command)
    })
  })
})
