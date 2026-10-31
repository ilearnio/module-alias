// ESM entry point for module-alias
// Provides programmatic API with auto-registered hooks

// Default import: a named registerHooks import fails to link where it is missing
import module from 'node:module'
import { addAlias as _addAlias, addAliases as _addAliases, addPath as _addPath, reset as _reset, resolveSync } from './esm-loader.mjs'

// One hook for the process lifetime. reset() only clears alias state, so the
// hook keeps its place in the loader chain and is never stacked.
let hooksRegistered = false

function ensureHooks() {
  if (hooksRegistered) return

  // registerHooks shipped in 22.15 and 23.5 (missing in 23.0 - 23.4)
  if (typeof module.registerHooks !== 'function') {
    console.warn('[module-alias] Programmatic ESM usage requires Node 22.15+. For older versions, use module-alias/register with _moduleAliases in package.json.')
    return
  }

  module.registerHooks({ resolve: resolveSync })
  hooksRegistered = true
}

export function addAlias(alias, target) {
  ensureHooks()
  _addAlias(alias, target)
}

export function addAliases(aliases) {
  ensureHooks()
  _addAliases(aliases)
}

export function addPath(path) {
  ensureHooks()
  _addPath(path)
}

export function reset() {
  _reset()
}

// Default export for compatibility with: import moduleAlias from 'module-alias'
import { init } from './esm-loader.mjs'

function moduleAlias(options) {
  ensureHooks()
  init(options)
}

moduleAlias.addAlias = addAlias
moduleAlias.addAliases = addAliases
moduleAlias.addPath = addPath
moduleAlias.reset = reset

export default moduleAlias
