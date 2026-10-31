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

    it('should pass absolute paths to nextResolve as file URLs', async function () {
      // Platform-native absolute path (C:\... on Windows, /... on POSIX)
      const targetPath = path.join(__dirname, '../src')
      addAlias('@src', targetPath)

      const context = { parentURL: 'file:///app.mjs' }
      let received
      const result = await resolve('@src/foo', context, (specifier, ctx) => {
        received = { specifier, ctx }
        return { url: 'resolved:' + specifier }
      })
      const expectedUrl = pathToFileURL(path.join(targetPath, 'foo')).href
      expect(received.specifier).to.equal(expectedUrl)
      expect(received.ctx).to.equal(context)
      expect(result.url).to.equal('resolved:' + expectedUrl)
      expect(result.shortCircuit).to.equal(undefined)
    })

    it('should pass absolute paths to nextResolve as plain paths for require()', async function () {
      // CommonJS resolution under registerHooks cannot take file: URLs
      const targetPath = path.join(__dirname, '../src')
      addAlias('@src', targetPath)

      // Node 22.15 passes conditions as a Set for require(), later versions as an array
      const received = []
      const next = (specifier) => {
        received.push(specifier)
        return { url: 'resolved:' + specifier }
      }
      await resolve('@src/foo', { conditions: ['node', 'require'] }, next)
      await resolve('@src/foo', { conditions: new Set(['node', 'require']) }, next)
      const plainPath = path.join(targetPath, 'foo')
      expect(received).to.deep.equal([plainPath, plainPath])
    })

    it('should keep query and hash outside the encoded file URL', async function () {
      const targetPath = path.join(__dirname, '../src')
      addAlias('@src', targetPath)

      const received = []
      const next = (specifier) => {
        received.push(specifier)
        return { url: specifier }
      }
      await resolve('@src/foo.mjs?v=1', {}, next)
      await resolve('@src/foo.mjs#frag', {}, next)
      const fileUrl = pathToFileURL(path.join(targetPath, 'foo.mjs')).href
      expect(received).to.deep.equal([fileUrl + '?v=1', fileUrl + '#frag'])
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
