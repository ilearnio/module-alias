/* eslint-env mocha */
import chai from 'chai'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPathMatchesAlias, resolveAlias, reset, addAlias, addAliases } from '../../esm-loader.mjs'

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
      expect(result).to.equal('/path/to/server')
    })

    it('should handle multiple aliases', function () {
      addAliases({
        '@lib': '/path/to/lib',
        '@utils': '/path/to/utils'
      })

      expect(resolveAlias('@lib/foo')).to.equal('/path/to/lib/foo')
      expect(resolveAlias('@utils/bar')).to.equal('/path/to/utils/bar')
    })
  })
})
