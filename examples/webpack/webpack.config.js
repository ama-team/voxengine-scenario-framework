var Path = require('path')

var entry = Path.resolve(__dirname, 'lib/scenario.js')

module.exports = {
  entry: entry,
  output: {
    filename: 'scenario.js',
    path: Path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: function (path) {
          if (path === entry) {
            return false
          }
          return path.split(/[\/\\]/).indexOf('node_modules') > -1
        },
        use: 'uglify-loader'
      }
    ]
  }
}
