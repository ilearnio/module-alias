// Registers a loader ahead of module-alias, the way tsx and similar tools do
import { register } from 'node:module'

register('./ext-loader.mjs', import.meta.url)
