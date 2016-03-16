var Module = require('module').Module
var nodePath = require('path')

var module_paths = []
var module_aliases = {}

var old_nodeModulePaths = Module._nodeModulePaths
Module._nodeModulePaths = function (from) {
  var paths = old_nodeModulePaths.call(this, from)

  // Only include the module path for top-level modules
  // that were not installed:
  if (from.indexOf('node_modules') === -1) {
    paths = module_paths.concat(paths)
  }

  return paths
}

var old_resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, self) {
  for (var alias in module_aliases) {
    if (request.indexOf(alias) === 0) {
      request = nodePath.join(
        module_aliases[alias],
        request.substr(alias.length)
      )
    }
  }

  return old_resolveFilename.apply(this, arguments)
}

function addPathHelper (path, targetArray) {
  path = nodePath.normalize(path)
  if (targetArray && targetArray.indexOf(path) === -1) {
    targetArray.unshift(path)
  }
}

function removePathHelper (path, targetArray) {
  if (targetArray) {
    var index = targetArray.indexOf(path)
    if (index !== -1) {
      targetArray.splice(index, 1)
    }
  }
}

function addPath (path) {
  var parent
  path = nodePath.normalize(path)

  if (module_paths.indexOf(path) === -1) {
    module_paths.push(path)
    // Enable the search path for the current top-level module
    addPathHelper(path, require.main.paths)
    parent = module.parent

    // Also modify the paths of the module that was used to load the
    // app-module-paths module and all of it's parents
    while (parent && parent !== require.main) {
      addPathHelper(path, parent.paths)
      parent = parent.parent
    }
  }
}

function addAliases (aliases) {
  for (var alias in aliases) {
    addAlias(alias, aliases[alias])
  }
}

function addAlias (alias, target) {
  module_aliases[alias] = target
}

/**
 * Reset any changes maded (resets all registered aliases
 * and custom module directories)
 * The function is undocumented and for testing purposes only
 */
function reset () {
  // Reset all changes in paths caused by addPath function
  module_paths.forEach(function (path) {
    removePathHelper(path, require.main.paths)
    var parent = module.parent
    while (parent && parent !== require.main) {
      removePathHelper(path, parent.paths)
      parent = parent.parent
    }
  })

  module_paths = []
  module_aliases = {}
}

/**
 * Import aliases from package.json
 * @param {object} options
 */
function init (options) {
  if (typeof options === 'string') {
    options = { base: options }
  }

  options = options || {}

  // There is probably 99% chance that the project root directory in located
  // above the node_modules directory
  var base = nodePath.resolve(
    options.base || nodePath.join(__dirname, '../..')
  )

  try {
    var npm_package = require(base + '/package.json')
  } catch (e) {
    // Do nothing
  }

  if (typeof npm_package !== 'object') {
    throw Error('Unable to read ' + base + '/package.json')
  }

  //
  // Import aliases
  //

  var aliases = npm_package._moduleAliases || {}

  for (var alias in aliases) {
    if (aliases[alias][0] !== '/') {
      aliases[alias] = nodePath.join(base, aliases[alias])
    }
  }

  addAliases(aliases)

  //
  // Register custom module directories (like node_modules)
  //

  if (npm_package._moduleDirectories instanceof Array) {
    npm_package._moduleDirectories.forEach(function (dir) {
      if (dir === 'node_modules') return

      var module_path = nodePath.join(base, dir)
      addPath(module_path)
    })
  }
}

module.exports = init
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.reset = reset
