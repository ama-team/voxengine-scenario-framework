/* eslint-env mocha */

var Stubs = require('@ama-team/voxengine-stubs')

Stubs.install()

beforeEach(Stubs.install)
afterEach(Stubs.uninstall)
