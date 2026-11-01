import { fileURLToPath } from 'node:url'
import { addAlias } from '../../../../index.mjs'

addAlias('@lib', fileURLToPath(new URL('./src/lib', import.meta.url)))

const { message } = await import('@lib/foo.mjs')
console.log(message)
