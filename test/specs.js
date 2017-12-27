/* eslint-env mocha */

var expect = require('chai').expect
var exec = require('child_process').exec
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

  it('should match aliases', function () {
    expect(moduleAlias.isPathMatchesAlias('@foo/bar', '@foo')).to.be.true
    expect(moduleAlias.isPathMatchesAlias('one/three', 'one')).to.be.true
    expect(moduleAlias.isPathMatchesAlias('/one/three', '/one')).to.be.true
  })

  it('should not match aliases', function () {
    expect(moduleAlias.isPathMatchesAlias('one-two/three', 'one')).to.be.false
    expect(moduleAlias.isPathMatchesAlias('/one-two/three', '/one')).to.be.false
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

  it('should import settings from different section of package.json', function () {
      moduleAlias({
          base: path.join(__dirname, 'src'),
          moduleAliases: "_testModuleAliases"
      })
      var test
      try {
          test = require('@test')
      } catch (e) {}
      expect(test).to.equal('Hello from test')
  })

  it('should support forked modules', function () {
    expect(require('hello-world-classic')).to.be.function
  })

  it('should handle mocha test', function (done) {
    exec('mocha ' + path.join(__dirname, '/src/mocha/test.js'), function (_, result) {
      expect(result.toString('utf8')).to.match(/1 passing/)
      done()
    })
  })

  it('should match longest alias first', function () {
    moduleAlias.addAliases({
      'react-dom': path.join(__dirname, 'src/bar/baz'),
      'react-dom/server': path.join(__dirname, 'src/foo')
    })

    var bar, src
    try {
      bar = require('react-dom')
      src = require('react-dom/server')
    } catch (e) {}

    expect(bar).to.equal('Hello from baz')
    expect(src).to.equal('Hello from foo')
  })
})
