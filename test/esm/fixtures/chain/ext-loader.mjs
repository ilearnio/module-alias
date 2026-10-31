// Maps file: URLs ending in .js to .mjs, mimicking TypeScript-style extension rewriting
export async function resolve (specifier, context, nextResolve) {
  if (specifier.startsWith('file:') && specifier.endsWith('.js')) {
    return nextResolve(specifier.slice(0, -3) + '.mjs', context)
  }
  return nextResolve(specifier, context)
}
