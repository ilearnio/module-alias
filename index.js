const Module = require('module')
const path = require('path')
const fs = require('fs')

let MODULE_PATH_LIST = []

const ALIAS_PATH_CACHE = new Map()
let ALIAS_KEY_LIST = []

const PACKAGE_BASE_CACHE = new Map()
let PACKAGE_PATH = process.cwd()

const {
  _nodeModulePaths: nodeModulePaths,
  _resolveFilename: resolveFilename
} = Module

function resolveModuleAlias (modulePath) {
  const aliasKey = ALIAS_KEY_LIST.find((aliasKey) => matches(modulePath, aliasKey))
  if (aliasKey) {
    const aliasPath = ALIAS_PATH_CACHE.get(aliasKey)

    return path.join(aliasPath, modulePath.substr(aliasKey.length))
  }
}

Module._nodeModulePaths = function (modulePath) {
  let paths = nodeModulePaths.call(this, modulePath)

  if (!modulePath.includes('node_modules')) paths = MODULE_PATH_LIST.concat(paths)

  return paths
}

Module._resolveFilename = function (modulePath, ...args) {
  return resolveFilename.call(this, resolveModuleAlias(modulePath) || modulePath, ...args)
}

const matches = (modulePath, alias) => (modulePath === alias) || (modulePath.startsWith(alias) && modulePath.charAt(alias.length) === '/')

function addPathIntoPaths (modulePath, paths) {
  const normalizedModulePath = path.normalize(modulePath)

  if (!paths.includes(normalizedModulePath)) paths.unshift(normalizedModulePath)
}

function removePathFromPaths (modulePath, paths) {
  const normalizedModulePath = path.normalize(modulePath)

  while (paths.includes(normalizedModulePath)) paths.splice(paths.indexOf(normalizedModulePath), 1)
}

function addPath (modulePath) {
  const normalizedModulePath = path.normalize(path.join(getPackagePath(), modulePath))

  if (!MODULE_PATH_LIST.includes(normalizedModulePath)) {
    MODULE_PATH_LIST.push(normalizedModulePath)

    const moduleMain = require.main

    if (moduleMain) {
      const {
        paths = []
      } = moduleMain

      addPathIntoPaths(normalizedModulePath, paths)
    }

    let {
      parent
    } = module

    while (parent) {
      const {
        paths = []
      } = parent

      addPathIntoPaths(normalizedModulePath, paths)

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

function addAlias (alias, modulePath, aliasPathCache = ALIAS_PATH_CACHE) {
  const normalizedModulePath = path.normalize(path.join(getPackagePath(), modulePath))

  aliasPathCache.set(alias, normalizedModulePath)
  ALIAS_KEY_LIST = Array.from(aliasPathCache.keys()).sort().reverse()
}

function reset (packageBaseCache = PACKAGE_BASE_CACHE, aliasPathCache = ALIAS_PATH_CACHE) {
  Object.keys(require.cache).forEach((key) => { delete require.cache[key] })

  const moduleMain = require.main

  MODULE_PATH_LIST.forEach((modulePath) => {
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

  MODULE_PATH_LIST = []

  packageBaseCache.clear()
  aliasPathCache.clear()

  ALIAS_KEY_LIST = []

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

function getPackagePathFromCache (packageBase, packageBaseCache = PACKAGE_BASE_CACHE) {
  if (packageBaseCache.has(packageBase)) return packageBaseCache.get(packageBase)
}

function setPackagePathIntoCache (packageBase, packagePath, packageBaseCache = PACKAGE_BASE_CACHE) {
  if (!packageBaseCache.has(packageBase)) packageBaseCache.set(packageBase, packagePath)
}

function removePackageBaseFromCache (packageBase, packageBaseCache = PACKAGE_BASE_CACHE) {
  packageBaseCache.delete(packageBase)
}

/*
 *  `packageBase` is the directory above/in which to find package.json
 *
 *  Aliased paths will be relative from there
 */
function register (packageBase = process.cwd(), packageBaseCache = PACKAGE_BASE_CACHE) {
  packageBase = packageBase.replace(/\/package\.json$/, '')

  const packagePath = getPackagePathFromCache(packageBase, packageBaseCache) || getPackagePathFromFileSystem(packageBase)

  if (!packagePath) throw new Error(`(1) No \`package.json\` found for ${packageBase}`)

  setPackagePath(packagePath)
  setPackagePathIntoCache(packageBase, packagePath, packageBaseCache)

  try {
    const packageJson = require(path.join(packagePath, 'package.json'))

    const {
      _moduleAliases: aliases = {},
      _moduleDirectories: directories = []
    } = packageJson

    registerModuleAliases(aliases)

    registerModuleDirectories(directories)
  } catch (e) {
    removePackageBaseFromCache(packageBaseCache)

    throw new Error(`(2) No \`package.json\` found for ${packageBase}`)
  }
}

module.exports = register
module.exports.addPath = addPath
module.exports.addAlias = addAlias
module.exports.addAliases = addAliases
module.exports.matches = matches
module.exports.reset = reset
