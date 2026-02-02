// ESM loader for module-alias
// Provides resolve hooks for ES modules

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve as pathResolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let aliases = {}
let moduleDirectories = []
let base = process.cwd()
let initialized = false

export function init (options = {}) {
  if (initialized) return

  const thisDir = dirname(fileURLToPath(import.meta.url))
  const candidatePaths = options.base
    ? [pathResolve(options.base)]
    : [join(thisDir, '../..'), process.cwd()]

  let pkg
  for (const candidate of candidatePaths) {
    try {
      pkg = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8'))
      base = candidate
      break
    } catch (e) {
      // Continue to next candidate
    }
  }

  if (!pkg) {
    console.warn('[module-alias] Unable to find package.json in:', candidatePaths.join(', '))
    initialized = true
    return
  }

  // Load _moduleAliases
  const pkgAliases = pkg._moduleAliases || {}
  for (const alias in pkgAliases) {
    const target = pkgAliases[alias]
    aliases[alias] = target.startsWith('/') ? target : join(base, target)
  }

  // Load _moduleDirectories
  if (Array.isArray(pkg._moduleDirectories)) {
    moduleDirectories = pkg._moduleDirectories
      .filter(d => d !== 'node_modules')
      .map(d => join(base, d))
  }

  initialized = true
}

export function isPathMatchesAlias (path, alias) {
  // Matching /^alias(\/|$)/
  if (path.indexOf(alias) === 0) {
    if (path.length === alias.length) return true
    if (path[alias.length] === '/') return true
  }
  return false
}

export function resolveAlias (specifier, parentURL) {
  init() // Ensure initialized

  // Sort aliases by length (longest first) for correct matching
  const sortedAliases = Object.keys(aliases).sort((a, b) => b.length - a.length)

  for (const alias of sortedAliases) {
    if (isPathMatchesAlias(specifier, alias)) {
      const target = aliases[alias]

      // Function-based resolver
      if (typeof target === 'function') {
        const parentPath = parentURL ? fileURLToPath(parentURL) : process.cwd()
        const result = target(parentPath, specifier, alias)
        if (!result || typeof result !== 'string') {
          throw new Error('[module-alias] Custom handler must return path')
        }
        return result
      }

      // String path - join target with remainder of specifier
      return join(target, specifier.slice(alias.length))
    }
  }

  // Check moduleDirectories
  for (const dir of moduleDirectories) {
    const modulePath = join(dir, specifier)
    // Check for directory with index.mjs/index.js
    if (existsSync(join(modulePath, 'index.mjs'))) {
      return join(modulePath, 'index.mjs')
    }
    if (existsSync(join(modulePath, 'index.js'))) {
      return join(modulePath, 'index.js')
    }
    // Check for file with extension
    if (existsSync(modulePath + '.mjs')) {
      return modulePath + '.mjs'
    }
    if (existsSync(modulePath + '.js')) {
      return modulePath + '.js'
    }
    // Check for exact file
    if (existsSync(modulePath) && !statSync(modulePath).isDirectory()) {
      return modulePath
    }
  }

  return null
}

export function addAlias (alias, target) {
  aliases[alias] = target
}

export function addAliases (aliasMap) {
  for (const alias in aliasMap) {
    addAlias(alias, aliasMap[alias])
  }
}

export function addPath (path) {
  moduleDirectories.push(path)
}

export function reset () {
  aliases = {}
  moduleDirectories = []
  base = process.cwd()
  initialized = false
}

// For Node 18-21: async loader hooks
export async function resolve (specifier, context, nextResolve) {
  const resolved = resolveAlias(specifier, context.parentURL)
  if (resolved) {
    // If absolute path, convert to file URL
    if (resolved.startsWith('/')) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }
    // Otherwise let Node resolve it (could be npm package)
    return nextResolve(resolved, context)
  }
  return nextResolve(specifier, context)
}

export async function initialize (data) {
  init(data || {})
}
