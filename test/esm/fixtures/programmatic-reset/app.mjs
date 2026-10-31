// Counts resolve hooks registered across reset() calls
import module from 'node:module'
import { fileURLToPath } from 'node:url'

let registered = 0
const originalRegisterHooks = module.registerHooks
module.registerHooks = (hooks) => {
  registered++
  return originalRegisterHooks(hooks)
}

const { addAlias, reset } = await import('../../../../index.mjs')
const lib = fileURLToPath(new URL('./src/lib', import.meta.url))

addAlias('@lib', lib)
reset()
addAlias('@lib', lib)
reset()
addAlias('@lib', lib)

const { message } = await import('@lib/foo.mjs')
console.log(message + ' (' + registered + ' hook)')
