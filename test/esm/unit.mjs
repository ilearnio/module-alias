/* eslint-env mocha */
import chai from 'chai'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isPathMatchesAlias, resolveAlias, reset, addAlias, addAliases, resolve } from '../../esm-loader.mjs'

const { expect } = chai
const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('ESM Loader', function () {
  describe('isPathMatchesAlias', function () {
    it('should match exact alias', function () {
      expect(isPathMatchesAlias('@lib', '@lib')).to.equal(true)
    })

    it('should match alias with subpath', function () {
      expect(isPathMatchesAlias('@lib/foo', '@lib')).to.equal(true)
      expect(isPathMatchesAlias('@lib/foo/bar', '@lib')).to.equal(true)
    })

    it('should reject partial prefix match', function () {
      expect(isPathMatchesAlias('@library', '@lib')).to.equal(false)
      expect(isPathMatchesAlias('@lib-utils', '@lib')).to.equal(false)
    })

    it('should match non-scoped aliases', function () {
      expect(isPathMatchesAlias('src/foo', 'src')).to.equal(true)
      expect(isPathMatchesAlias('src', 'src')).to.equal(true)
    })

    it('should reject non-matching paths', function () {
      expect(isPathMatchesAlias('other/path', '@lib')).to.equal(false)
      expect(isPathMatchesAlias('', '@lib')).to.equal(false)
    })
  })

  describe('resolveAlias', function () {
    afterEach(function () {
      reset()
    })

    it('should resolve alias to path', function () {
      const targetPath = path.join(__dirname, '../src')
      addAlias('@src', targetPath)

      const result = resolveAlias('@src/foo')
      expect(result).to.equal(path.join(targetPath, '/foo'))
    })

    it('should resolve exact alias match', function () {
      const targetPath = path.join(__dirname, '../src/foo/index.js')
      addAlias('@foo', targetPath)

      const result = resolveAlias('@foo')
      expect(result).to.equal(targetPath)
    })

    it('should return null for non-aliased specifier', function () {
      addAlias('@src', '/some/path')

      const result = resolveAlias('other-module')
      expect(result).to.equal(null)
    })

    it('should return null for node_modules specifier', function () {
      addAlias('@src', '/some/path')

      const result = resolveAlias('lodash')
      expect(result).to.equal(null)
    })

    it('should match longest alias first', function () {
      addAliases({
        'react-dom': '/path/to/react-dom',
        'react-dom/server': '/path/to/server'
      })

      const result = resolveAlias('react-dom/server')
      expect(result).to.equal(path.join('/path/to/server'))
    })

    it('should handle multiple aliases', function () {
      addAliases({
        '@lib': '/path/to/lib',
        '@utils': '/path/to/utils'
      })

      expect(resolveAlias('@lib/foo')).to.equal(path.join('/path/to/lib', 'foo'))
      expect(resolveAlias('@utils/bar')).to.equal(path.join('/path/to/utils', 'bar'))
    })
  })

  describe('resolve hook', function () {
    afterEach(function () {
      reset()
    })

    it('should convert absolute paths to file URLs', async function () {
      // Platform-native absolute path (C:\... on Windows, /... on POSIX)
      const targetPath = path.join(__dirname, '../src')
      addAlias('@src', targetPath)

      const result = await resolve('@src/foo', {}, () => {
        throw new Error('nextResolve should not be called for absolute paths')
      })
      expect(result.url).to.equal(pathToFileURL(path.join(targetPath, 'foo')).href)
      expect(result.shortCircuit).to.equal(true)
    })

    it('should pass non-absolute resolved specifiers to nextResolve', async function () {
      addAlias('lodash-alias', 'lodash')

      const result = await resolve('lodash-alias/fp', {}, (specifier) => {
        return { url: 'resolved:' + specifier }
      })
      expect(result.url).to.equal('resolved:' + path.join('lodash', 'fp'))
    })

    it('should pass non-aliased specifiers through unchanged', async function () {
      addAlias('@src', '/some/path')

      const result = await resolve('other-module', {}, (specifier) => {
        return { url: 'resolved:' + specifier }
      })
      expect(result.url).to.equal('resolved:other-module')
    })
  })
})
