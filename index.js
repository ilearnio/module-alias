const Module = require('module')
const path = require('path')
const fs = require('fs')

let MODULE_PATHS = []
let MODULE_ALIAS_HASH = {}
let MODULE_ALIAS_KEYS = []

const CACHE = new Map()

let PACKAGE_PATH = process.cwd()

const {
  _nodeModulePaths: nodeModulePaths,
  _resolveFilename: resolveFilename
} = Module

function resolveModuleAlias (modulePath) {
  let i = 0
  const j = MODULE_ALIAS_KEYS.length

  /*
   * The array is (already) sorted and reversed
   * so that the loop can match the longest alias
   * before the shortest
   */
  for (i, j; i < j; i++) {
    const aliasKey = MODULE_ALIAS_KEYS[i]

    if (matches(modulePath, aliasKey)) {
      const moduleAliasPath = MODULE_ALIAS_HASH[aliasKey]

      return path.join(moduleAliasPath, modulePath.substr(aliasKey.length))
    }
  }
}

Module._nodeModulePaths = function (modulePath) {
  let paths = nodeModulePaths.call(this, modulePath)

  if (!modulePath.includes('node_modules')) paths = MODULE_PATHS.concat(paths)

  return paths
}

Module._resolveFilename = function (modulePath, ...args) {
  return resolveFilename.call(this, resolveModuleAlias(modulePath) || modulePath, ...args)
}

function matches (modulePath, alias) {
  if (modulePath.startsWith(alias)) {
    if (modulePath.length === alias.length) return true
    if (modulePath[alias.length] === '/') return true
  }

  return false
}

function addPathIntoPaths (modulePath, paths) {
  modulePath = path.normalize(modulePath)

  if (!paths.includes(modulePath)) paths.unshift(modulePath)
}

function removePathFromPaths (modulePath, paths) {
  modulePath = path.normalize(modulePath)

  while (paths.includes(modulePath)) paths.splice(paths.indexOf(modulePath), 1)
}

function addPath (modulePath) {
  modulePath = path.normalize(path.join(getPackagePath(), modulePath))

  if (!MODULE_PATHS.includes(modulePath)) {
    MODULE_PATHS.push(modulePath)

    const moduleMain = require.main

    if (moduleMain) {
      const {
        paths = []
      } = moduleMain

      addPathIntoPaths(modulePath, paths)
    }

    let {
      parent
    } = module

    while (parent) {
      const {
        paths = []
      } = parent

      addPathIntoPaths(modulePath, paths)

      parent = parent.parent
    }
  }
}

function addAliases (aliases) {
  Object.entries(aliases)
    .forEach(([alias, modulePath]) => {
      addAlias(alias, modulePath)
    })
}

function addAlias (alias, modulePath) {
  MODULE_ALIAS_HASH[alias] = path.normalize(path.join(getPackagePath(), modulePath))
  MODULE_ALIAS_KEYS = Object.keys(MODULE_ALIAS_HASH).sort().reverse()
}

function reset (cache = CACHE) {
  Object.keys(require.cache).forEach((key) => { delete require.cache[key] })

  const moduleMain = require.main

  MODULE_PATHS.forEach((modulePath) => {
    const {
      paths = []
    } = module

    removePathFromPaths(modulePath, paths)

    let {
      parent
    } = module

    while (parent) {
      const {
        paths = []
      } = parent

      removePathFromPaths(modulePath, paths)

      parent = parent.parent
    }

    if (moduleMain) {
      const {
        paths = []
      } = moduleMain

      removePathFromPaths(modulePath, paths)
    }
  })

  MODULE_PATHS = []
  MODULE_ALIAS_HASH = {}
  MODULE_ALIAS_KEYS = []

  cache.clear()

  PACKAGE_PATH = process.cwd()
}

function registerModuleAliases (aliases = {}) {
  Object.entries(aliases)
    .forEach(([alias, modulePath]) => {
      if (modulePath.charAt(0) !== '/') {
        addAlias(alias, modulePath)
      }
    })
}

function registerModuleDirectories (directories = []) {
  directories
    .forEach((directory) => {
      if (directory !== 'node_modules') {
        addPath(directory)
      }
    })
}

function getPackagePath () {
  return PACKAGE_PATH
}

function setPackagePath (packagePath) {
  PACKAGE_PATH = packagePath
}

function getPackagePathFromFileSystem (packageBase) {
  let packagePath = path.dirname(packageBase)
  const packagePaths = [packageBase, packagePath]

  while (packagePath !== (packageBase = path.dirname(packagePath))) packagePaths.push(packagePath = packageBase)

  return packagePaths.find((packagePath) => {
    try {
      /*
       *  Skip over `require`
       */
      const fileData = fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8')
      const json = JSON.parse(fileData)

      return (
        Reflect.has(json, '_moduleAliases') ||
        Reflect.has(json, '_moduleDirectories')
      )
    } catch (e) {
      return false
    }
  })
}

function getPackagePathFromCache (packageBase, cache = CACHE) {
  if (cache.has(packageBase)) return cache.get(packageBase)
}

function setPackagePathIntoCache (packageBase, packagePath, cache = CACHE) {
  if (!cache.has(packageBase)) cache.set(packageBase, packagePath)
}

function removePackageBaseFromCache (packageBase, cache = CACHE) {
  cache.delete(packageBase)
}

/*
 *  `packageBase` is the directory above/in which to find package.json
 *
 *  Aliased paths will be relative from there
 */
function register (packageBase = process.cwd(), cache = CACHE) {
  packageBase = packageBase.replace(/\/package\.json$/, '')

  const packagePath = getPackagePathFromCache(packageBase, cache) || getPackagePathFromFileSystem(packageBase)

  if (!packagePath) throw new Error(`(1) No \`package.json\` found for ${packageBase}`)

  setPackagePath(packagePath)
  setPackagePathIntoCache(packageBase, packagePath, cache)

  try {
    const packageJson = require(path.join(packagePath, 'package.json'))

    const {
      _moduleAliases: aliases = {},
      _moduleDirectories: directories = []
    } = packageJson

    registerModuleAliases(aliases)

    registerModuleDirectories(directories)
  } catch (e) {
    removePackageBaseFromCache(cache)

    throw new Error(`(2) No \`package.json\` found for ${packageBase}`)
  }
}

module.exports = register
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.matches = matches
module.exports.reset = reset
