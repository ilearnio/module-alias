// ESM entry point for module-alias
// Usage: node --import module-alias/register ./app.mjs

import { register } from 'node:module'

// Check Node version for registerHooks support (22.15+)
const [major, minor] = process.versions.node.split('.').map(Number)
const hasRegisterHooks = major > 22 || (major === 22 && minor >= 15)

if (hasRegisterHooks) {
  // Node 22.15+ - use synchronous hooks on main thread
  const { registerHooks } = await import('node:module')
  const { resolveSync, init } = await import('./esm-loader.mjs')

  init()

  registerHooks({ resolve: resolveSync })
} else {
  // Node 18.19 - 22.14 - use async hooks via worker thread
  register('./esm-loader.mjs', {
    parentURL: import.meta.url
  })
}
