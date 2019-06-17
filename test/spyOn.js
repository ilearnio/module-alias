function spyOn (obj, property) {
  var spy = {
    callCount: 0,
    allArgs: [],
    lastArgs: undefined,

    reset: function () {
      spy.callCount = 0
      spy.allArgs = []
      spy.lastArgs = undefined
    },

    restore: function () {
      obj[property] = originalMethod
    }
  }

  var originalMethod = obj[property]

  obj[property] = function () {
    spy.callCount += 1
    spy.allArgs.push(arguments)
    spy.lastArgs = arguments

    return originalMethod.apply(obj, arguments)
  }

  return spy
}

module.exports = spyOn
