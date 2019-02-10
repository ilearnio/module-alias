'use strict'

var BuiltinModule = require('module')

// Guard against poorly mocked module constructors
var Module = module.constructor.length > 1
  ? module.constructor
  : BuiltinModule

var nodePath = require('path')

/** @type {Array.<string>} */
var modulePaths = []

/** @type {{[alias: string]: (string|RequireHandlerFunction)}} */
var moduleAliases = {}

/** @type {Array.<string>} */
var moduleAliasNames = []

// Tell node to search for modules in specified directories
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
Module._resolveFilename = function (request, parentModule, isMain) {
  for (var i = moduleAliasNames.length; i-- > 0;) {
    var alias = moduleAliasNames[i]
    if (isPathMatchesAlias(request, alias)) {
      var aliasTarget = moduleAliases[alias]
      // Custom function handler
      if (typeof moduleAliases[alias] === 'function') {
        var fromPath = parentModule.filename
        aliasTarget = moduleAliases[alias](fromPath, request, alias)
        if (!aliasTarget || typeof aliasTarget !== 'string') {
          throw new Error('[module-alias] Expecting custom handler function to return path.')
        }
      }
      request = nodePath.join(aliasTarget, request.substr(alias.length))
      // Only use the first match
      break
    }
  }

  return oldResolveFilename.call(this, request, parentModule, isMain)
}

/**
 * Determines if path matches alias.
 * @param {string} path
 * @param {string} alias
 * @returns {boolean}
 */
function isPathMatchesAlias (path, alias) {
  // Matching /^alias(\/|$)/
  if (path.indexOf(alias) === 0) {
    if (path.length === alias.length) return true
    if (path[alias.length] === '/') return true
  }

  return false
}

/**
 * Adds path to paths array.
 * @param {string} path
 * @param {Array.<string>} targetArray
 */
function addPathHelper (path, targetArray) {
  path = nodePath.normalize(path)
  if (targetArray && targetArray.indexOf(path) === -1) {
    targetArray.unshift(path)
  }
}

/**
 * Removes path from paths array.
 * @param {string} path
 * @param {Array.<string>} targetArray
 */
function removePathHelper (path, targetArray) {
  if (targetArray) {
    var index = targetArray.indexOf(path)
    if (index !== -1) {
      targetArray.splice(index, 1)
    }
  }
}

/**
 * Register custom modules directory.
 * @param {string} path
 * @example
 * ModuleAlias.addPath('/src/utils')
 */
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

/**
 * Register multiple aliases.
 * @param {{string: string}} aliases
 * @example
 * ModuleAlias.addAliases({
 * 'Components': '/src/components',
 * 'Utils': '/src/utils'
 * })
 */
function addAliases (aliases) {
  for (var alias in aliases) {
    addAlias(alias, aliases[alias])
  }
}

/**
 * Register a single alias.
 * @param {string} alias Alias
 * @param {string} path Target path
 * @example ModuleAlias.addAlias('Utils', '/src/utils')
 */
function addAlias (alias, path) {
  moduleAliases[alias] = path
  // Cost of sorting is lower here than during resolution
  moduleAliasNames = Object.keys(moduleAliases)
  moduleAliasNames.sort()
}

/**
 * Resets all changes made (registered aliases and module directories).
 * For testing purposes only.
 * @private
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
 * Imports aliases from package.json.
 * @param {(string|Options)} [options]
 */
function init (options) {
  if (typeof options === 'string') {
    options = { base: options }
  }

  options = options || {}

  // TODO: Find a better way to locate root directory
  // The project root directory is probably located above the node_modules directory
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

/**
 * @typedef {Object} Options
 * @prop {string} [base] Path to package.json to import aliases from.
 */

/**
 * @callback RequireHandlerFunction
 * @param {string} fromPath Path to the file that require is called from.
 * @param {string} request Path passed into require.
 * @param {string} alias The alias passed into addAlias.
 * @return {string} Target path to require from.
 */

module.exports = init
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.isPathMatchesAlias = isPathMatchesAlias
module.exports.reset = reset
