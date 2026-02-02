// ESM entry point for module-alias
// Provides programmatic API with auto-registered hooks

import { registerHooks } from 'node:module'
import { addAlias as _addAlias, addAliases as _addAliases, addPath as _addPath, reset as _reset, resolveAlias } from './esm-loader.mjs'

let hooksRegistered = false

function ensureHooks() {
  if (hooksRegistered) return

  const [major, minor] = process.versions.node.split('.').map(Number)
  const hasRegisterHooks = major > 22 || (major === 22 && minor >= 15)

  if (!hasRegisterHooks) {
    console.warn('[module-alias] Programmatic ESM usage requires Node 22.15+. For older versions, use module-alias/register with _moduleAliases in package.json.')
    return
  }

  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = resolveAlias(specifier, context.parentURL)
      if (resolved) {
        return nextResolve(resolved, context)
      }
      return nextResolve(specifier, context)
    }
  })

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
  hooksRegistered = false
}
