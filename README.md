# module-alias
[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

Allows to register aliases of directories and custom module paths in NodeJS.

This package is highly inspired by [app-module-path](https://www.npmjs.com/package/app-module-path) package and it's totally backwards compatible with it. The main difference is that this package is also allows you to create aliases of directories for further usage with `require`/`import`

## Install

```
npm i --save module-alias
```

## Usage

Add these lines to your package.json (in your application's root)

```
"_moduleDirectories": ["node_modules_custom"],
"_moduleAliases": {
  "@root"      : "", // Application's root
  "@client"    : "src/client",
  "@admin"     : "src/client/admin",
  "@deep"      : "src/some/very/deep/directory",
  "@my_module" : "src/some-file.js",
  "something"  : "src/foo", // Or without @. Actually, alias could be any string
}
```

And these line at the very main file of your app, before any code

```js
import 'module-alias/register'

// And you're all set, now you can do stuff like
import 'something'
import foo from '@foo'
import deepModule from '@bar/my-module'
import module from 'some-module' // module from `node_modules_custom` directory
```

## Advanced usage

```js
import moduleAlias from 'module-alias'

//
// Register alias
//
moduleAlias.addAlias('@server', __dirname + '/src/server')

// Or multiple aliases
moduleAlias.addAliases({
  '@root'  : __dirname,
  '@server': __dirname + '/src/server',
  ...
})

//
// Register custom modules directory (like node_modules, but
// with your own modules)
//
moduleAlias.addPath(__dirname + '/node_modules_custom')
moduleAlias.addPath(__dirname + '/src')

//
// Import settings from package.json
//
moduleAlias(__dirname + '/package.json')

// Or let mudule-alias to figure where your package.json is
// located. By default it will look in the same directory
// where you have your node_modules (application's root)
moduleAlias()
```

## Usage with WebPack

```js
// webpack.config.js
const npm_package = require('./package.json')

module.exports = {
  entry: { ... },
  resolve: {
    root: __dirname,
    alias: npm_package._moduleAliases || {},
    extensions: ['', '.js', '.jsx'],
    modulesDirectories: npm_package._moduleDirectories || [] // eg: ["node_modules", "node_modules_custom", "src"]
  }
}
```

### Tags
Require alias, node import alias, node custom module directory, node local require paths, register module directory in nodejs

[npm-image]: https://img.shields.io/npm/v/module-alias.svg
[npm-url]: https://npmjs.org/package/module-alias
[travis-image]: https://img.shields.io/travis/ilearnio/module-alias/master.svg
[travis-url]: https://travis-ci.org/ilearnio/module-alias
