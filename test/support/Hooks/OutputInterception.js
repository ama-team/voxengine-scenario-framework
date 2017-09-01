/* eslint-env mocha */
/* global allure */

function StreamInterceptor (stream) {
  var logs = []
  var originalWriteMethod = stream.write

  this.initialize = function () {
    stream.write = function (a, b, c) {
      originalWriteMethod.call(stream, a, b, c)
      logs.push(a)
    }
    return this
  }

  this.flush = function (filename) {
    if (logs.length) {
      allure.createAttachment(filename, logs.join('\n'), 'text/plain')
      logs = []
    }
    return this
  }

  this.stop = function () {
    stream.write = originalWriteMethod
    return this
  }
}

var interceptors = {
  stdout: null,
  stderr: null
}

beforeEach(function () {
  Object.keys(interceptors).forEach(function (stream) {
    interceptors[stream] = new StreamInterceptor(process[stream]).initialize()
  })
})

afterEach(function () {
  Object.keys(interceptors).forEach(function (stream) {
    var interceptor = interceptors[stream]
    interceptor.stop().flush(stream + '.log')
  })
})
