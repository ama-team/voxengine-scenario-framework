var FileSystem = require('fs')

FileSystem.readdirSync(__dirname + '/tasks').forEach(function (entry) {
  if (!/\.jake$/.test(entry)) {
    return
  }
  require(__dirname + '/tasks/' + entry)
})