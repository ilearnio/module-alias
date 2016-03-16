# module-alias
[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

Allows to register aliases of directories and custom module paths in NodeJS.

This package is highly inspired by [app-module-path](https://www.npmjs.com/package/app-module-path) package and it's totally backwards compatible with it. The main difference is that this package also allows creating aliases of directories for further usage with `require`/`import`

## Install

```
npm i --save module-alias
```

## Usage

Add these lines to your `package.json` (in your application's root)

```js
// Aliases
"_moduleAliases": {
  "@root"      : "", // Application's root
  "@client"    : "src/client",
  "@admin"     : "src/client/admin",
  "@deep"      : "src/some/very/deep/directory",
  "@my_module" : "src/some-file.js",
  "something"  : "src/foo", // Or without @. Actually, it could be any string
}

// Custom modules directory (optional)
"_moduleDirectories": ["node_modules_custom"],
```

Then add these line at the very main file of your app, before any code

```js
import 'module-alias/register'
```

And you're all set! Now you can do stuff like:

```js
import 'something'
import module from '@root/some-module'
import veryDeepModule from '@deep/my-module'
import myModule from '@my_module' // module from `node_modules_custom` directory
```

## Advanced usage

```js
import moduleAlias from 'module-alias'

//
// Register alias
//
moduleAlias.addAlias('@client', __dirname + '/src/client')

// Or multiple aliases
moduleAlias.addAliases({
  '@root'  : __dirname,
  '@client': __dirname + '/src/client',
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

## How it works?

In order to register a custom modules path (`addPath`) it modifies the internal `Module._nodeModulePaths` method so that the given directory then acts like it's the `node_modules` directory.

In order to register an alias it modifies the internal `Module._resolveFilename` method so that when you fire `require` or `import` it first checks whether the given string starts with one of the registered aliases, if so, it then replaces the alias in the string with the target path of the alias

[npm-image]: https://img.shields.io/npm/v/module-alias.svg
[npm-url]: https://npmjs.org/package/module-alias
[travis-image]: https://img.shields.io/travis/ilearnio/module-alias/master.svg
[travis-url]: https://travis-ci.org/ilearnio/module-alias
