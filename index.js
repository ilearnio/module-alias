'use strict'

var BuiltinModule = require('module')

// Guard against poorly mocked module constructors
var Module = module.constructor.length > 1
  ? module.constructor
  : BuiltinModule

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
          throw new Error('[module-alias] Expecting custom handler function to return path.')
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
// Functions to load configurations from a file
//

// Load configuration from any file
function readConfigFile (path) {
  try {
    var config = require(path)

    if (nodePath.basename(path) === 'package.json') {
      // Support for legacy package.json config definitions
      if (config._moduleAliases || config._moduleDirectories) {
        config = {
          aliases: config._moduleAliases,
          moduleDirectories: config._moduleDirectories
        }
      }

      if (config && config['module-alias']) {
        config = config['module-alias']
      }
    } else if (config && config.default) { // ES module default export
      config = config.default
    }

    if (config) {
      config.aliases = config.aliases || {}
      config.moduleDirectories = config.moduleDirectories || []
    }

    // Support ES6 export default
    return config
  } catch (e) {
    // Do nothing
  }
}

function loadConfig (base) {
  var candidateProjectPaths
  if (base) {
    candidateProjectPaths = [nodePath.resolve(base)]
  } else {
    // There is probably 99% chance that the project root directory in located above the
    // node_modules directory, or that package.json is in the node process' current working
    // directory (when running a package manager script, e.g. `yarn start` / `npm run start`)
    candidateProjectPaths = [nodePath.join(__dirname, '../..'), process.cwd()]
  }

  var config
  var projectPath
  for (var i in candidateProjectPaths) {
    projectPath = candidateProjectPaths[i]
    var filename = nodePath.basename(projectPath)

    if (/.\.(m?js|json)$/.test(filename)) { // check supported config file extensions
      // Try custom config path
      config = readConfigFile(projectPath)
      projectPath = nodePath.dirname(projectPath)
    } else {
      // Try module-alias.config.js
      config = readConfigFile(nodePath.join(projectPath, 'module-alias.config.js'))

      // Try package.json
      if (!config) {
        config = readConfigFile(nodePath.join(projectPath, 'package.json'))
      }
    }
    if (config) break
  }

  return {
    projectPath: projectPath,
    config: config
  }
}

/**
 * Initialize aliases from a config file
 * @param {object} options
 */
function init (options) {
  options = options || {}

  var base = typeof options === 'string' ? options : options.base

  var loadedConfigData = loadConfig(base)
  var projectPath = loadedConfigData.projectPath
  var config = loadedConfigData.config

  if (typeof config !== 'object') {
    throw new Error('[module-alias] Unable to find configuration file')
  }

  //
  // Register aliases
  //

  var aliases = {}
  for (var alias in config.aliases) {
    if (config.aliases[alias][0] !== '/') {
      aliases[alias] = nodePath.join(projectPath, config.aliases[alias])
    }
  }
  addAliases(aliases)

  //
  // Register custom module directories (like node_modules)
  //

  config.moduleDirectories.forEach(function (dir) {
    if (dir === 'node_modules') return
    var modulePath = nodePath.join(projectPath, dir)
    addPath(modulePath)
  })
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
