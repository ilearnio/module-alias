/* eslint-env mocha */

var expect = require('chai').expect
var path = require('path')
var moduleAlias = require('..')

describe('module-alias', function () {
  afterEach(moduleAlias.reset)

  it('should register path (addPath)', function () {
    var value
    try {
      value = require('foo')
    } catch (e) {}
    expect(value).to.not.ok

    moduleAlias.addPath(path.join(__dirname, 'src'))
    try {
      value = require('foo')
    } catch (e) {}
    expect(value).to.equal('Hello from foo')
  })

  it('should register an alias (addAlias)', function () {
    moduleAlias.addAlias('@baz', path.join(__dirname, 'src/bar/baz'))

    var value
    try {
      value = require('@baz')
    } catch (e) {}

    expect(value).to.equal('Hello from baz')
  })

  it('should reset any changes after previous test cases (reset)', function () {
    var foo = null
    var baz = null
    try {
      foo = require('foo')
      baz = require('@baz')
    } catch (e) {}

    expect(foo).to.be.null
    expect(baz).to.be.null
  })

  it('should register multiple aliases (addAliases)', function () {
    moduleAlias.addAliases({
      '@src': path.join(__dirname, 'src'),
      '@foo': path.join(__dirname, 'src/foo/index.js'),
      '@bar': path.join(__dirname, 'src/bar'),
      'something/foo': path.join(__dirname, 'src/foo')
    })

    var src, foo, baz, something
    try {
      src = require('@src/foo')
      foo = require('@foo')
      baz = require('@bar/baz')
      something = require('something/foo')
    } catch (e) {}

    expect(src).to.equal('Hello from foo')
    expect(foo).to.equal('Hello from foo')
    expect(baz).to.equal('Hello from baz')
    expect(something).to.equal('Hello from foo')
  })

  it('should import settings from package.json', function () {
    moduleAlias({
      base: path.join(__dirname, 'src')
    })

    var src, foo, baz, some, someModule
    try {
      src = require('@src/foo')
      foo = require('@foo')
      baz = require('@bar/baz')
      some = require('some/foo')
      someModule = require('some-module')
    } catch (e) {}

    expect(src).to.equal('Hello from foo')
    expect(foo).to.equal('Hello from foo')
    expect(baz).to.equal('Hello from baz')
    expect(some).to.equal('Hello from foo')
    expect(someModule).to.equal('Hello from some-module')
  })

  it('should support forked modules', function () {
    expect(require('hello-world-classic')).to.be.function
  })
})
