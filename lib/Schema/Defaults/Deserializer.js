module.exports = function (input) {
  // TODO: add logging
  try {
    return !input || input === '' ? {} : JSON.parse(input)
  } catch (e) {
    return {customData: input}
  }
}
