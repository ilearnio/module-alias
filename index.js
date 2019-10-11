'use strict'

var BuiltinModule = require('module')

// Guard against poorly mocked module constructors
var Module = module.constructor.length > 1 ? module.constructor : BuiltinModule

var nodePath = require('path')

var modulePaths = []
var moduleAliases = {}
var moduleAliasNames = []

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
Module._resolveFilename = function (request, parentModule, isMain, options) {
  for (var i = moduleAliasNames.length; i-- > 0;) {
    var alias = moduleAliasNames[i]
    if (isPathMatchesAlias(request, alias)) {
      var aliasTarget = moduleAliases[alias]
      // Custom function handler
      if (typeof moduleAliases[alias] === 'function') {
        var fromPath = parentModule.filename
        aliasTarget = moduleAliases[alias](fromPath, request, alias)
        if (!aliasTarget || typeof aliasTarget !== 'string') {
          throw new Error(
            '[module-alias] Expecting custom handler function to return path.'
          )
        }
      }
      request = nodePath.join(aliasTarget, request.substr(alias.length))
      // Only use the first match
      break
    }
  }

  return oldResolveFilename.call(this, request, parentModule, isMain, options)
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
    var mainModule = getMainModule()
    if (mainModule) {
      addPathHelper(path, mainModule.paths)
    }
    parent = module.parent

    // Also modify the paths of the module that was used to load the
    // app-module-paths module and all of it's parents
    while (parent && parent !== mainModule) {
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
  var mainModule = getMainModule()

  // Reset all changes in paths caused by addPath function
  modulePaths.forEach(function (path) {
    if (mainModule) {
      removePathHelper(path, mainModule.paths)
    }

    // Delete from require.cache if the module has been required before.
    // This is required for node >= 11
    Object.getOwnPropertyNames(require.cache).forEach(function (name) {
      if (name.indexOf(path) !== -1) {
        delete require.cache[name]
      }
    })

    var parent = module.parent
    while (parent && parent !== mainModule) {
      removePathHelper(path, parent.paths)
      parent = parent.parent
    }
  })

  modulePaths = []
  moduleAliases = {}
  moduleAliasNames = []
}

//
// Utility function
//

// Removes file name from the base and returns only dir.
function getBaseDir (base) {
  var parsed = nodePath.parse(base)
  return parsed.ext ? parsed.dir : base
}

//
// Functions to load configurations from a file
//

// Load configuration from any file
function loadConfigFile (configPath) {
  try {
    var config = require(configPath)

    // ES6 export default
    if (config && config.default) {
      return config.default
    }

    return config
  } catch (e) {
    // Do nothing
  }
}

// Load configuration from the package.json file
function loadPackageJSONFile (configPath) {
  try {
    var config = require(configPath)

    if (config && config['module-alias']) {
      return config['module-alias']
    }

    return {}
  } catch (e) {
    // Do nothing
  }
}

function loadConfig (base, options) {
  var configPath = ''
  var config

  // If a path has been provided, try loading the configuration using it
  // It could be a simple JS, JSON or any file, or a package.json file
  if (options.base) {
    configPath = options.base

    if (configPath.indexOf('package.json') > -1) {
      config = loadPackageJSONFile(configPath)
    } else {
      config = loadConfigFile(configPath)
    }
  }

  // Try module-alias.config.js
  if (!config) {
    configPath = nodePath.join(base, 'module-alias.config.js')
    config = loadConfigFile(configPath)
  }

  // Try package.json
  if (!config) {
    configPath = nodePath.join(base, 'package.json')
    config = loadPackageJSONFile(configPath)
  }

  if (!config) {
    throw new Error('Failed to load configuration.')
  }

  return config
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

  var candidatePackagePaths
  if (options.base) {
    candidatePackagePaths = [nodePath.resolve(options.base.replace(/\/package\.json$/, ''))]
  } else {
    // There is probably 99% chance that the project root directory in located
    // above the node_modules directory,
    // Or that package.json is in the node process' current working directory (when
    // running a package manager script, e.g. `yarn start` / `npm run start`)
    // candidatePackagePaths = [nodePath.join(__dirname, "../.."), process.cwd()];
    candidatePackagePaths = [nodePath.join(__dirname, '../..'), process.cwd()]
  }

  var config
  var base
  for (var i in candidatePackagePaths) {
    try {
      base = candidatePackagePaths[i]

      // Load the configuration
      config = loadConfig(base, options)

      break
    } catch (e) {
      // noop
    }
  }

  if (typeof config !== 'object') {
    var pathString = candidatePackagePaths.join(',\n')
    throw new Error('Unable to find configuration in any of:\n[' + pathString + ']')
  }

  //
  // Import aliases
  //

  var aliases = config.aliases || {}

  for (var alias in aliases) {
    if (aliases[alias][0] !== '/') {
      aliases[alias] = nodePath.join(getBaseDir(base), aliases[alias])
    }
  }

  addAliases(aliases)

  //
  // Register custom module directories (like node_modules)
  //

  var moduleDirectories = config.moduleDirectories || []

  if (moduleDirectories instanceof Array) {
    moduleDirectories.forEach(function (dir) {
      if (dir === 'node_modules') return

      var modulePath = nodePath.join(getBaseDir(base), dir)
      addPath(modulePath)
    })
  }
}

function getMainModule () {
  return require.main._simulateRepl ? undefined : require.main
}

module.exports = init
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.isPathMatchesAlias = isPathMatchesAlias
module.exports.reset = reset
