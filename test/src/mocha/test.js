/* eslint-env mocha */
var path = require('path')
var assert = require('assert')
var moduleAlias = require('../../..')

moduleAlias.addAlias('@hello', path.join(__dirname, '/hello.js'))

it('should pass', function () {
  assert(require('@hello') === 'Hello')
})
