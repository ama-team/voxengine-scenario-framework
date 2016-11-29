var objects = {
        overwrite: function (target, source, deep) {
            for (var key in source) {
                if (source.hasOwnProperty(key) || deep) {
                    target[key] = source[key];
                }
            }
            return target;
        },
        isString: function (v) { return v.constructor === String || typeof v === 'string'; }
    },
    functions = {
        PassThrough: function (v) { return v; },
        ReThrow: function (e) { throw e; },
        NoOp: function() {}
    };


objects.copy = function (source, deep) {
    return objects.overwrite({}, source, deep);
};

exports = module.exports = {
    /**
     * @deprecated
     */
    object: objects,
    objects: objects,
    functions: functions
};
