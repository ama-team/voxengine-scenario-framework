var loggers = require('@ama-team/voxengine-sdk').loggers,
    chai = require('chai'),
    stderrLogger,
    stdoutLogger,
    runtimeLogger,
    runtimeLogs,
    unhandledPromisesLogger,
    unhandledPromises;

function StreamInterceptor(stream) {
    var logs = [],
        originalWriteMethod = stream.write;

    this.start = function () {
        stream.write = function (a, b, c) {
            originalWriteMethod.call(stream, a, b, c);
            logs.push(a);
        };
        return this;
    };

    this.flush = function (filename) {
        if (logs.length) {
            allure.createAttachment(filename, logs.join('\n'), 'text/plain');
            logs = [];
        }
        return this;
    };

    this.stop = function () {
        stream.write = originalWriteMethod;
        return this;
    };
}

function setup() {

    beforeEach(function () {
        if (!('allure' in global)) {
            return;
        }
        unhandledPromises = [];
        stdoutLogger = new StreamInterceptor(process.stdout).start();
        stderrLogger = new StreamInterceptor(process.stderr).start();

        runtimeLogs = [];
        /** @type Writable */
        var writer = {
            write: function (message) {
                runtimeLogs.push(message);
            }
        };
        runtimeLogger = new loggers.slf4j(writer, loggers.LogLevel.All);

        unhandledPromises = [];
        unhandledPromisesLogger = function (reason, promise) {
            var message = 'Unhandled promise rejection: \n' + reason + '\n';
            console.error(message);
            unhandledPromises.push({message: message, promise: promise});
        };
        process.on('unhandledRejection', unhandledPromisesLogger);
    });

    afterEach(function () {
        if (!('allure' in global)) {
            return;
        }
        stdoutLogger.flush('stdout').stop();
        stderrLogger.flush('stderr').stop();
        process.removeListener('unhandledRejection', unhandledPromisesLogger);
        if (unhandledPromises.length) {
            var content = unhandledPromises.map(function (v) { return v.message; }).join('\n');
            allure.createAttachment('unhandled-promises.log', content, 'text/plain');
        }
        if (runtimeLogs.length) {
            allure.createAttachment('runtime.log', runtimeLogs.join('\n'), 'text/plain');
        }
    });

}

var resolvedFactory = function (v) {
    return function () {
        return Promise.resolve(v);
    }
};

var rejectedFactory = function (e) {
    return function () {
        return Promise.reject(e);
    }
};

//noinspection JSUnusedGlobalSymbols
exports = module.exports = {
    setup: setup,
    getLogger: function () { return runtimeLogger; },
    getUnhandledPromises: function () { return unhandledPromises; },
    resolvedFactory: resolvedFactory,
    resolved: resolvedFactory(),
    rejectedFactory: rejectedFactory,
    rejected: rejectedFactory(),
    infinite: function () {
        return new Promise(function () {});
    },
    restrictedBranchHandler: function () {
        chai.assert.fail('this branch should have never been executed');
    }
};