/* eslint-env mocha */
var expect = require('chai').expect
var execSync = require('child_process').execSync
var path = require('path')
var semver = require('semver')

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
      var registerPath = path.join(moduleAliasRoot, 'register.mjs')

      var result = execSync(
        'node --import ' + registerPath + ' app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from foo')
    })
  })

  describe('moduleDirectories', function () {
    it('should resolve modules from custom directories', function () {
      var fixture = path.join(fixturesDir, 'module-dirs')
      var registerPath = path.join(moduleAliasRoot, 'register.mjs')

      var result = execSync(
        'node --import ' + registerPath + ' app.mjs',
        { cwd: fixture, encoding: 'utf8' }
      )

      expect(result.trim()).to.equal('Hello from custom module')
    })
  })
})
