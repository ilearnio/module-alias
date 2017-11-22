'use strict'

var BuiltinModule = require('module')

// Guard against poorly mocked module constructors
var Module = module.constructor.length > 1
  ? module.constructor
  : BuiltinModule

var nodePath = require('path')

var modulePaths = []
var moduleAliases = {}
var moduleAliasNames = [];

var oldNodeModulePaths = Module._nodeModulePaths
Module._nodeModulePaths = function (from) {
  var paths = oldNodeModulePaths.call(this, from)

  // Only include the module path for top-level modules
  // that were not installed:
  if (from.indexOf('node_modules') === -1) {
    paths = modulePaths.concat(paths)
  }

  return paths
}

var oldResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain) {
  for (var i = moduleAliasNames.length; i-- > 0;) {
    var alias = moduleAliasNames[i]
    if (isPathMatchesAlias(request, alias)) {
      request = nodePath.join(
        moduleAliases[alias],
        request.substr(alias.length)
      )
      // Only use the first match
      break
    }
  }

  return oldResolveFilename.call(this, request, parent, isMain)
}

function isPathMatchesAlias (path, alias) {
  // Matching /^alias(\/|$)/
  if (path.indexOf(alias) === 0) {
    if (path.length === alias.length) return true
    if (path[alias.length] === '/') return true
  }

  return false
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

  if (modulePaths.indexOf(path) === -1) {
    modulePaths.push(path)
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
  moduleAliases[alias] = target
  // Cost of sorting is lower here than during resolution
  moduleAliasNames = Object.keys(moduleAliases)
  moduleAliasNames.sort()
}

/**
 * Reset any changes maded (resets all registered aliases
 * and custom module directories)
 * The function is undocumented and for testing purposes only
 */
function reset () {
  // Reset all changes in paths caused by addPath function
  modulePaths.forEach(function (path) {
    removePathHelper(path, require.main.paths)
    var parent = module.parent
    while (parent && parent !== require.main) {
      removePathHelper(path, parent.paths)
      parent = parent.parent
    }
  })

  modulePaths = []
  moduleAliases = {}
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
  var packagePath = base.replace(/\/package\.json$/, '') + '/package.json'

  try {
    var npmPackage = require(packagePath)
  } catch (e) {
    // Do nothing
  }

  if (typeof npmPackage !== 'object') {
    throw new Error('Unable to read ' + packagePath)
  }

  //
  // Import aliases
  //

  var aliases = npmPackage._moduleAliases || {}

  for (var alias in aliases) {
    if (aliases[alias][0] !== '/') {
      aliases[alias] = nodePath.join(base, aliases[alias])
    }
  }

  addAliases(aliases)

  //
  // Register custom module directories (like node_modules)
  //

  if (npmPackage._moduleDirectories instanceof Array) {
    npmPackage._moduleDirectories.forEach(function (dir) {
      if (dir === 'node_modules') return

      var modulePath = nodePath.join(base, dir)
      addPath(modulePath)
    })
  }
}

module.exports = init
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.isPathMatchesAlias = isPathMatchesAlias
module.exports.reset = reset
