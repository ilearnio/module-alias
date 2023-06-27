'use strict'

var BuiltinModule = require('module')

// Guard against poorly mocked module constructors
var Module = module.constructor.length > 1
  ? module.constructor
  : BuiltinModule

var nodePath = require('path')
var nodeFS = require('fs')

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
  var found = false
  for (var i = moduleAliasNames.length; i-- > 0 && !found;) {
    var alias = moduleAliasNames[i]
    if (isPathMatchesAlias(request, alias)) {
      var aliasTargets = moduleAliases[alias]

      for (var v = 0; v < aliasTargets.length && !found; v++) {
        var aliasTarget = aliasTargets[v]

        // First check for a simple string
        if (typeof aliasTarget === 'string') {
          // No-op
        // Custom function handler
        } else if (typeof aliasTarget === 'function') {
          var fromPath = parentModule.filename
          aliasTarget = aliasTarget(fromPath, request, alias)
          if (!aliasTarget || typeof aliasTarget !== 'string') {
            throw new Error('[module-alias] Expecting custom handler function to return path.')
          }
        // And for everything else...
        } else {
          throw new Error('[module-alias] Expecting alias target to be string or function.')
        }

        // Construct the path
        request = nodePath.join(aliasTarget, request.substr(alias.length))

        // Now, we need to decide whether or not we'll be continuing our loop
        // through targets or stopping here. We're going to do this by checking
        // for the existence of a file matching request or a directory
        // containing a package.json matching the request.

        // If it's a directory and it contains a package.json, index, index.js,
        // or index.node file, we're good to go.
        if (
          isDirectory(request) && (
            isFile(nodePath.join(request, 'package.json')) ||
            isFile(nodePath.join(request, 'index')) ||
            isFile(nodePath.join(request, 'index.js')) ||
            isFile(nodePath.join(request, 'index.node'))
          )
        ) {
          found = true
          break
        // If it's a file as-is or when appended with .js or .node, rock and
        // roll.
        } else if (
          isFile(request) ||
          isFile(request + '.js') ||
          isFile(request + '.node')
        ) {
          found = true
          break
        }
      }

      // There should be only one alias that matches, but you never know.
      break
    }
  }

  return oldResolveFilename.call(this, request, parentModule, isMain, options)
}

function isFile (path) {
  var stat
  try {
    stat = nodeFS.statSync(path)
  } catch (err) {
    return false
  }
  return stat.isFile()
}

function isDirectory (path) {
  var stat
  try {
    stat = nodeFS.statSync(path)
  } catch (err) {
    return false
  }
  return stat.isDirectory()
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

function addAlias (alias, targets) {
  if (moduleAliases[alias] === undefined) {
    moduleAliases[alias] = []
  }

  if ((typeof targets === 'object') && (targets.constructor.name === 'Array')) {
    moduleAliases[alias] = moduleAliases[alias].concat(targets)
  } else if ((typeof targets === 'string') || (typeof targets === 'function')) {
    moduleAliases[alias].push(targets)
  } else {
    throw new Error('[module-alias] Expecting alias targets to be string, function, or array of strings and/or functions.')
  }

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
    candidatePackagePaths = [nodePath.join(__dirname, '../..'), process.cwd()]
  }

  var npmPackage
  var base
  for (var i in candidatePackagePaths) {
    try {
      base = candidatePackagePaths[i]

      npmPackage = require(nodePath.join(base, 'package.json'))
      break
    } catch (e) {
      // noop
    }
  }

  if (typeof npmPackage !== 'object') {
    var pathString = candidatePackagePaths.join(',\n')
    throw new Error('Unable to find package.json in any of:\n[' + pathString + ']')
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

function getMainModule () {
  return require.main._simulateRepl ? undefined : require.main
}

module.exports = init
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.isPathMatchesAlias = isPathMatchesAlias
module.exports.reset = reset
