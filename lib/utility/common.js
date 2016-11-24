var objects = {},
    functions = {
        PassThrough: function (v) {
            return v;
        },
        ReThrow: function (e) {
            throw e;
        }
    };

objects.overwrite = function (target, source, deep) {
    for (var key in source) {
        if (source.hasOwnProperty(key) || deep) {
            target[key] = source[key];
        }
    }
    return target;
};

objects.copy = function (source, deep) {
    return objects.overwrite({}, source, deep);
};

objects.isString = function (v) {
    return v.constructor === String || typeof v === 'string';
};

exports = module.exports = {
    /**
     * @deprecated
     */
    object: objects,
    objects: objects,
    functions: functions
};
