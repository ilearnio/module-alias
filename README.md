# module-alias
[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

Create aliases of directories and register custom module paths in NodeJS like a boss!

No more shit-coding paths in Node like so:

```js
require('../../../../some/very/deep/module')
```
Enough of this madness!

Just create an alias and do it the right way:

```js
var module = require('@deep/module')
// Or ES6
import module from '@deep/module'
```

It also allows you to register directories that will act just like `node_modules` but with your own private modules, so that you can access them directly:

```js
require('my_private_module');
// Or ES6
import module from 'my_private_module'
```

**WARNING:** This module should not be used in other npm modules since it modifies the default `require` behavior! It is designed to be used for development of final projects i.e. web-sites, applications etc.

## Install

```
npm i --save module-alias
```

**BREAKING CHANGES:** Version 3 has a new way to add configurations. The older format is no longer supported in this version. If you are using the older version, please check out the [documentation for version 2.X](https://github.com/ilearnio/module-alias/blob/c82d4bbcb6677d8abcf2cd4446b4f03e6e2feff4/README.md).

## Usage

There are a couple of ways to configure this module.

### module-alias.config.js

Create a new file (in your application's root) with the name of `module-alias.config.js` and add your custom configuration. The module looks for this configuration file first.

```js
module.exports = {
  // Aliases
  aliases: {
    "@root"      : ".", // Application's root
    "@deep"      : "src/some/very/deep/directory/or/file",
    "@my_module" : "lib/some-file.js",
    "something"  : "src/foo", // Or without @. Actually, it could be any string
  },
  
  // Custom module directories, just like `node_modules` but with your private modules (optional)
  moduleDirectories: ["node_modules_custom"],
}
```

### package.json

If you don't have `module-alias.config.js` in your application's root directory, the module will load your configurations from your `package.json` file.

```json
    ...
    "module-alias": {
      // Aliases
      "aliases": {
        "@root"      : ".", // Application's root
        "@deep"      : "src/some/very/deep/directory/or/file",
        "@my_module" : "lib/some-file.js",
        "something"  : "src/foo", // Or without @. Actually, it could be any string
      },
      
      // Custom module directories, just like `node_modules` but with your private modules (optional)
      "moduleDirectories": ["node_modules_custom"] 
    }
```

Then add this line at the very main file of your app, before any code

```js
require('module-alias/register')
```

**And you're all set!** Now you can do stuff like:

```js
require('something')
const module = require('@root/some-module')
const veryDeepModule = require('@deep/my-module')
const customModule = require('my_private_module') // module from `node_modules_custom` directory

// Or ES6
import 'something'
import module from '@root/some-module'
import veryDeepModule from '@deep/my-module'
import customModule from 'my_private_module' // module from `node_modules_custom` directory
```

### Custom config path

If you don't want to create `module-alias.config.js` file or modify your `package.json` file, you can create a `.js` file with any name and pass the path to the module.

The configuration will be the same as the `module-alias.config.js` but a different file name.

```js
require('module-alias')({
  base: 'path/to/the/configuration/file.js'
})
```

If the `module-alias.config.js` file or your `package.json` file is in a sub-directory, simply pass the path to the directory in options.

```js
require('module-alias')({
  base: 'path/to/the/sub-directory'
})
```

## Advanced usage

If you prefer to set it all up programmatically, then the following methods are available for you:

* `addAlias('alias', 'target_path')` - register a single alias
* `addAliases({ 'alias': 'target_path', ... }) ` - register multiple aliases
* `addPath(path)` - Register custom modules directory (like node_modules, but with your own modules)

_Examples:_
```js
const moduleAlias = require('module-alias')

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

// Custom handler function (starting from v2.1)
moduleAlias.addAlias('@src', (fromPath, request, alias) => {
  // fromPath - Full path of the file from which `require` was called
  // request - The path (first argument) that was passed into `require`
  // alias - The same alias that was passed as first argument to `addAlias` (`@src` in this case)

  // Return any custom target path for the `@src` alias depending on arguments
  if (fromPath.startsWith(__dirname + '/others')) return __dirname + '/others'
  return __dirname + '/src'
})

//
// Register custom modules directory
//
moduleAlias.addPath(__dirname + '/node_modules_custom')
moduleAlias.addPath(__dirname + '/src')

//
// Import settings from a specific package.json
//
moduleAlias(__dirname + '/package.json')

// Or let module-alias to figure where your package.json is
// located. By default it will look in the same directory
// where you have your node_modules (application's root)
moduleAlias()
```

## Usage with WebPack

Luckily, WebPack has a built in support for aliases and custom modules directories so it's easy to make it work on the client side as well!

### With module-alias.config.js

```js
// webpack.config.js
const config = require('./module-alias.config.js')

module.exports = {
  entry: { ... },
  resolve: {
    root: __dirname,
    alias: config.aliases || {},
    modules: config.moduleDirectories || [] // eg: ["node_modules", "node_modules_custom", "src"]
  }
}
```

### With package.json

```js
// webpack.config.js
const config = require('./package.json')['module-alias']

module.exports = {
  entry: { ... },
  resolve: {
    root: __dirname,
    alias: config.aliases || {},
    modules: config.moduleDirectories || [] // eg: ["node_modules", "node_modules_custom", "src"]
  }
}
```

More details on the [official documentation](https://webpack.js.org/configuration/resolve).

## Usage with Jest

Unfortunately, `module-alias` itself would not work from Jest due to a custom behavior of Jest's `require`. But you can use it's own aliasing mechanism instead. The configuration can be defined either in `package.json` or `jest.config.js`. The example below is for `package.json`:

```js
"jest": {
  "moduleNameMapper": {
    "@root/(.*)": "<rootDir>/$1",
    "@client/(.*)": "<rootDir>/src/client/$1"
  },
}
```

More details on the [official documentation](https://jestjs.io/docs/en/configuration#modulenamemapper-objectstring-string).

## Known incompatibilities

This module does not play well with:

- Front-end JavaScript code. Module-alias is designed for server side so do not expect it to work with front-end frameworks (React, Vue, ...) as they tend to use Webpack. Use Webpack's [resolve.alias](https://webpack.js.org/configuration/resolve/#resolvealias) mechanism instead.
- [Jest](https://jestjs.io), which discards node's module system entirely to use it's own module system, bypassing module-alias.
- The [NCC compiler](https://github.com/zeit/ncc), as it uses WebPack under the hood without exposing properties, such as resolve.alias. It is not [something they wish to do](https://github.com/zeit/ncc/pull/460).

## How it works?

In order to register an alias it modifies the internal `Module._resolveFilename` method so that when you use `require` or `import` it first checks whether the given string starts with one of the registered aliases, if so, it replaces the alias in the string with the target path of the alias.

In order to register a custom modules path (`addPath`) it modifies the internal `Module._nodeModulePaths` method so that the given directory then acts like it's the `node_modules` directory.

[npm-image]: https://img.shields.io/npm/v/module-alias.svg
[npm-url]: https://npmjs.org/package/module-alias
[travis-image]: https://img.shields.io/travis/ilearnio/module-alias/master.svg
[travis-url]: https://travis-ci.org/ilearnio/module-alias

## Refactor your code (for already existing projects)

If you are using this on an existing project, you can use [relative-to-alias](https://github.com/s-yadav/relative-to-alias) to refactor your code to start using aliases.
