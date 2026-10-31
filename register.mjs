// ESM entry point for module-alias
// Usage: node --import module-alias/register ./app.mjs

import module from 'node:module'

// Feature check, not a version check: registerHooks shipped in 22.15 and
// 23.5, so 23.0 - 23.4 do not have it
if (typeof module.registerHooks === 'function') {
  // Synchronous hooks on the main thread
  const { resolveSync, init } = await import('./esm-loader.mjs')

  init()

  module.registerHooks({ resolve: resolveSync })
} else {
  // Older Node - async hooks via worker thread
  module.register('./esm-loader.mjs', {
    parentURL: import.meta.url
  })
}
