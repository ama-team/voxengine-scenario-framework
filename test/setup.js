var stderrLogger,
    stdoutLogger,
    unhandledPromisesLogger,
    unhandledPromisesLogs;

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

beforeEach(function () {
    if (!('allure' in global)) {
        return;
    }
    unhandledPromisesLogs = [];
    stdoutLogger = new StreamInterceptor(process.stdout).start();
    stderrLogger = new StreamInterceptor(process.stderr).start();
    unhandledPromisesLogger = function (reason, promise) {
        var message = 'Unhandled promise rejection: \n' + reason + '\n';
        console.error(message);
        unhandledPromisesLogs.push(message);
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
});