var Validator = {
  validate: function (fixture) {
    function error (message) {
      throw new Error('Fixture ' + fixture.id + ' ' + message)
    }
    if (!fixture.type) {
      error('doesn\'t specify type')
    }
  }
}

module.exports = {
  Validator: Validator
}
