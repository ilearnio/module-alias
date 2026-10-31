/* eslint-env mocha */
var expect = require('chai').expect
var execSync = require('child_process').execSync
var path = require('path')
var semver = require('semver')
var pathToFileURL = require('url').pathToFileURL

describe('ESM Integration', function () {
  // Skip all ESM tests on Node < 18.19.0
  if (semver.lt(process.version, '18.19.0')) {
    console.log('Skipping ESM integration tests on Node ' + process.version)
    return
  }

  var fixturesDir = path.join(__dirname, 'fixtures')
  var moduleAliasRoot = path.join(__dirname, '../..')

  describe('basic alias', function () {
    it('should resolve alias in ESM with --import flag', function () {
      var fixture = path.join(fixturesDir, 'basic')
      var registerUrl = pathToFileURL(path.join(moduleAliasRoot, 'register.mjs')).href

      var result = execSync(
        'node --import ' + registerUrl + ' app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from foo')
    })
  })

  describe('moduleDirectories', function () {
    it('should resolve modules from custom directories', function () {
      var fixture = path.join(fixturesDir, 'module-dirs')
      var registerUrl = pathToFileURL(path.join(moduleAliasRoot, 'register.mjs')).href

      var result = execSync(
        'node --import ' + registerUrl + ' app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from custom module')
    })
  })

  describe('loader chain', function () {
    it('should hand aliased file URLs to loaders registered earlier', function () {
      var fixture = path.join(fixturesDir, 'chain')
      var registerUrl = pathToFileURL(path.join(moduleAliasRoot, 'register.mjs')).href

      var result = execSync(
        'node --import ./ext-hook.mjs --import ' + registerUrl + ' app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from chained loader')
    })
  })

  describe('programmatic API', function () {
    // index.mjs relies on module.registerHooks (Node 22.15+)
    var it22 = semver.gte(process.version, '22.15.0') ? it : it.skip

    it22('should resolve an alias added with addAlias to an absolute path', function () {
      var fixture = path.join(fixturesDir, 'programmatic')

      var result = execSync(
        'node app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from programmatic alias')
    })
  })

  describe('require() under register.mjs', function () {
    // register.mjs uses module.registerHooks on Node 22.15+, which also
    // intercepts CommonJS require()
    var it22 = semver.gte(process.version, '22.15.0') ? it : it.skip

    it22('should resolve aliases in require() calls', function () {
      var fixture = path.join(fixturesDir, 'require')
      var registerUrl = pathToFileURL(path.join(moduleAliasRoot, 'register.mjs')).href

      var result = execSync(
        'node --import ' + registerUrl + ' app.cjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from require')
    })
  })
})
