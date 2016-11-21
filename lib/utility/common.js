var object = {};

object.overwrite = function (target, source, deep) {
    for (var key in source) {
        if (source.hasOwnProperty(key) || deep) {
            target[key] = source[key];
        }
    }
    return target;
};

object.copy = function (source, deep) {
    return object.overwrite({}, source, deep);
};

exports = module.exports = {
    object: object
};
