var object = {};

object.overwrite = function (target, source, deep) {
    if (deep) {
        // todo implement
        throw {
            name: 'NotImplementedException',
            message: 'This functionality has not been implemented yet'
        }
    }
    Object.keys(source).forEach(function (key) {
        target[key] = source[key];
    });
    return target;
};

object.copy = function (source, deep) {
    return object.overwrite({}, source, deep);
};

exports = module.exports = {
    object: object
};
