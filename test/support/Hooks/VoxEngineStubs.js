/* eslint-env mocha */

var Stubs = require('@ama-team/voxengine-stubs')

module.exports = {
  setup: function () {
    Stubs.install()

    beforeEach(Stubs.install)
    afterEach(Stubs.uninstall)
  }
}
