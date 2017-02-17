var slf4j = require('@ama-team/voxengine-sdk').logger.slf4j,
    Slf4j = slf4j.Slf4j,
    LogLevel = slf4j.Level,
    chai = require('chai'),
    stderrLogger,
    stdoutLogger,
    runtimeLogger,
    runtimeLogs,
    unhandledPromiseLogger,
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

    if (!('allure' in global)) {
        global.allure = {
            fake: true,
            createStep: function (name, fn) {
                return fn;
            },
            createAttachment: function (name, content, mimeType) {
                console.log('Document ' + name + ' (' + mimeType + '):');
                console.log(content);
            }
        }
    }

    beforeEach(function () {
        unhandledPromises = [];
        unhandledPromiseLogger = function (reason, promise) {
            var message = 'Unhandled promise rejection: \n' + reason + '\n';
            console.error(message);
            unhandledPromises.push({message: message, promise: promise});
        };
        process.on('unhandledRejection', unhandledPromiseLogger);

        stdoutLogger = new StreamInterceptor(process.stdout).start();
        stderrLogger = new StreamInterceptor(process.stderr).start();

        /** @type Writable */
        writer = {
            write: function (message) {
                console.log(message);
                runtimeLogs.push(message);
            }
        };
        runtimeLogs = [];
        runtimeLogger = new Slf4j('ama-team.voxengine-scenario-framework.test.helper.common', LogLevel.All, writer);
    });

    afterEach(function () {
        stdoutLogger.stop();
        stderrLogger.stop();
        process.removeListener('unhandledRejection', unhandledPromiseLogger);
        if (unhandledPromises.length > 0) {
            this.test.error(new Error('Unhandled promises were fired during execution'));
        }
        stdoutLogger.flush('stdout');
        stderrLogger.flush('stderr');
        if (unhandledPromises.length) {
            var content = unhandledPromises.map(function (v) {
                return v.message;
            }).join('\n');
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