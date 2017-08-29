var Objects = {
  /**
   * @param {object|*} v
   * @return {boolean}
   */
  isObject: function (v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
  },
  /**
   * @param {Function|*} v
   * @return {boolean}
   */
  isFunction: function (v) {
    return typeof v === 'function'
  },
  /**
   * @param {object} source
   * @param {boolean} [deep]
   * @return {object}
   */
  copy: function (source, deep) {
    return Objects.merge({}, source, deep)
  },
  /**
   * @param {object|*} target
   * @param {object|*} source
   * @param {boolean} [deep]
   * @return {object}
   */
  merge: function (target, source, deep) {
    if (!Objects.isObject(source)) {
      return source
    }
    target = Objects.isObject(target) ? target : {}
    Object.keys(source).forEach(function (key) {
      target[key] = deep ? Objects.merge(target[key], source[key], true) : source[key]
    })
    return target
  }
}

module.exports = {
  Objects: Objects
}
