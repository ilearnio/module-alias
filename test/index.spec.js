const path = require('path')

const {
  expect
} = require('chai')

describe('`@ministryofjustice/module-alias`', () => {
  let moduleAlias

  before(() => { moduleAlias = require('..') })

  afterEach(() => {
    moduleAlias.reset()
  })

  it('resets (reset)', () => {
    let foo = null
    let baz = null

    try {
      foo = require('foo')
      baz = require('@baz')
    } catch (e) { }

    expect(foo).to.equal(null)
    expect(baz).to.equal(null)
  })

  it('registers a module path (addPath)', () => {
    let value

    try {
      value = require('foo')
    } catch (e) {}

    expect(value).to.equal(undefined)

    /*
     *  Relative path
     */
    moduleAlias.addPath('./test/src')

    expect(require('foo')).to.equal('Hello from foo')
  })

  it('registers a module alias (addAlias)', () => {
    let value

    try {
      value = require('@baz')
    } catch (e) {}

    expect(value).to.equal(undefined)

    /*
     *  Relative path
     */
    moduleAlias.addAlias('@baz', './test/src/bar/baz')

    expect(require('@baz')).to.equal('Hello from baz')
  })

  it('registers all module aliases (addAliases)', () => {
    let src
    let foo
    let baz
    let something

    try {
      src = require('@src/foo')
      foo = require('@foo')
      baz = require('@bar/baz')
      something = require('something/foo')
    } catch (e) {}

    expect(src).to.equal(undefined)
    expect(foo).to.equal(undefined)
    expect(baz).to.equal(undefined)
    expect(something).to.equal(undefined)

    /*
     *  Relative paths
     */
    moduleAlias.addAliases({
      '@src': './test/src',
      '@foo': './test/src/foo/index.js',
      '@bar': './test/src/bar',
      'something/foo': './test/src/foo'
    })

    expect(require('@src/foo')).to.equal('Hello from foo')
    expect(require('@foo')).to.equal('Hello from foo')
    expect(require('@bar/baz')).to.equal('Hello from baz')
    expect(require('something/foo')).to.equal('Hello from foo')
  })

  it('matches aliases', () => {
    expect(moduleAlias.matches('@foo/bar', '@foo')).to.equal(true)
    expect(moduleAlias.matches('one/three', 'one')).to.equal(true)
    expect(moduleAlias.matches('/one/three', '/one')).to.equal(true)
  })

  it('matches longer aliases before shorter aliases (matches)', () => {
    /*
     *  Relative paths
     */
    moduleAlias.addAliases({
      'react-dom': './test/src/bar/baz',
      'react-dom/server': './test/src/foo'
    })

    expect(require('react-dom')).to.equal('Hello from baz')
    expect(require('react-dom/server')).to.equal('Hello from foo')
  })

  it('does not match non-aliases (matches)', () => {
    expect(moduleAlias.matches('@baz', '@foo')).to.equal(false)
    expect(moduleAlias.matches('one-two/three', 'one')).to.equal(false)
    expect(moduleAlias.matches('/one-two/three', '/one')).to.equal(false)
  })

  describe('resolving module aliases from `package.json`', () => {
    context('a user-defined path is passed', () => {
      const CWD = process.cwd()

      afterEach(() => {
        process.chdir(CWD)
      })

      it('registers module aliases the `package.json` nearest to the user-defined path', () => {
        process.chdir(CWD)

        moduleAlias(path.resolve('./test/src'))

        expect(require('@src/foo')).to.equal('Hello from foo')
        expect(require('@foo')).to.equal('Hello from foo')
        expect(require('@bar/baz')).to.equal('Hello from baz')
        expect(require('some/foo')).to.equal('Hello from foo')
        expect(require('some-module')).to.equal('Hello from some-module')
      })
    })

    context('a nested user-defined path is passed', () => {
      const CWD = process.cwd()

      afterEach(() => {
        process.chdir(CWD)
      })

      it('registers module aliases from the `package.json` nearest to the nested user-defined path', () => {
        process.chdir(path.resolve('./test/src'))

        moduleAlias(path.resolve('./node_modules/module-alias'))

        expect(require('@src/foo')).to.equal('Hello from nested foo')
        expect(require('@foo')).to.equal('Hello from nested foo')
        expect(require('@bar/baz')).to.equal('Hello from nested baz')
        expect(require('some/foo')).to.equal('Hello from nested foo')
        expect(require('some-module')).to.equal('Hello from nested some-module')
      })
    })

    context('a user-defined path is not passed', () => {
      const CWD = process.cwd()

      afterEach(() => {
        process.chdir(CWD)
      })

      it('registers module aliases from the `package.json` nearest to the default path', () => {
        process.chdir(CWD)

        moduleAlias()

        expect(require('@src/foo')).to.equal('Hello from foo')
        expect(require('@foo')).to.equal('Hello from foo')
        expect(require('@bar/baz')).to.equal('Hello from baz')
        expect(require('some/foo')).to.equal('Hello from foo')
        expect(require('some-module')).to.equal('Hello from some-module')
      })
    })
  })

  it('resolves module aliases with `require.resolve()`', () => {
    /*
     *  Relative path
     */
    moduleAlias.addAliases({
      'some-alias': './test/src/foo'
    })

    expect(require.resolve('some-alias')).to.equal(path.resolve(path.join('./test/src/foo', 'index.js')))
  })
})
