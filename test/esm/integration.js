/* eslint-env mocha */
var expect = require('chai').expect
var childProcess = require('child_process')
var execSync = childProcess.execSync
var execFileSync = childProcess.execFileSync
var path = require('path')
var semver = require('semver')
var pathToFileURL = require('url').pathToFileURL

// Same feature check the entry points use (22.15+ and 23.5+)
var hasRegisterHooks = typeof require('module').registerHooks === 'function'

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
    // index.mjs relies on module.registerHooks
    var itHooks = hasRegisterHooks ? it : it.skip

    itHooks('should resolve an alias added with addAlias to an absolute path', function () {
      var fixture = path.join(fixturesDir, 'programmatic')

      var result = execSync(
        'node app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from programmatic alias')
    })
  })

  describe('require() under register.mjs', function () {
    // register.mjs uses module.registerHooks where available, which also
    // intercepts CommonJS require()
    var itHooks = hasRegisterHooks ? it : it.skip

    itHooks('should resolve aliases in require() calls', function () {
      var fixture = path.join(fixturesDir, 'require')
      var registerUrl = pathToFileURL(path.join(moduleAliasRoot, 'register.mjs')).href

      var result = execSync(
        'node --import ' + registerUrl + ' app.cjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from require')
    })
  })

  describe('programmatic entry point', function () {
    it('should load on every Node version that runs the ESM suite', function () {
      var indexUrl = pathToFileURL(path.join(moduleAliasRoot, 'index.mjs')).href
      var script = 'import m from "' + indexUrl + '"; console.log(typeof m.addAlias)'

      var result = execFileSync(
        'node', ['--input-type=module', '-e', script],
        { encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('function')
    })
  })

  describe('programmatic API reset', function () {
    var itHooks = hasRegisterHooks ? it : it.skip

    itHooks('should keep a single resolve hook across reset() calls', function () {
      var fixture = path.join(fixturesDir, 'programmatic-reset')

      var result = execSync(
        'node app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello after reset (1 hook)')
    })
  })
})
