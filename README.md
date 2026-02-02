# module-alias

[![NPM Version][npm-image]][npm-url]

Donations are much appreciated and would help me continue working on this package! [Donate here ❤️](https://tinyurl.com/donate-module-alias).

---

Create aliases of directories and register custom module paths in NodeJS like a boss!

No more long paths in Node, like:

```js
import something from ('../../../../some/very/deep/module');
```

Enough of this madness!

Just create an alias and do it the right way:

```js
import module from '@deep/module'
// Or CommonJS
const module = require('@deep/module')
```

It also allows you to register directories that will act just like `node_modules` but with your own private modules, so that you can access them directly:

```js
import module from 'my_private_module'
// Or CommonJS
const module = require('my_private_module')
```

**WARNING:** If you are going to use this package within another NPM package, please read [Using within another NPM package](#using-within-another-npm-package) first to be aware of potential caveats.

## Install

```
npm i --save module-alias
```

## Usage

### ES Modules (Node 18.19+)

Add your custom configuration to your `package.json` (in your application's root):

```json
{
  "_moduleAliases": {
    "@root": ".",
    "@lib": "src/lib",
    "@utils": "src/utils"
  },
  "_moduleDirectories": ["node_modules_custom"]
}
```

Run your app with the `--import` flag:

```bash
node --import module-alias/register ./app.mjs # Or use a custom registerer, see below
```

**Why the `--import` flag?**

Unlike CommonJS, you cannot import `module-alias/register` at runtime. All `import` statements are hoisted and resolved before any code runs. The `--import` flag loads the loader hooks before your application starts.

### Programmatic ESM Usage (Node 22.15+):

For programmatic alias registration, create a custom loader file:

```js
// my-aliases.mjs
import { addAlias, addAliases } from 'module-alias'

addAlias('@utils', process.cwd() + '/src/utils')
// or
addAliases({
  '@utils': process.cwd() + '/src/utils',
  '@lib': process.cwd() + '/src/lib'
})

// Custom handler function
addAlias('@src', (fromPath, request, alias) => {
  // fromPath - Full path of the file from which `import` was called
  // request - The path that was passed into `import` (e.g. '@src/utils.js')
  // alias - The alias being matched (`@src` in this case)
  const subpath = request.slice(alias.length) // e.g. '/utils.js'
  const base = fromPath.includes('/tests/') ? '/mocks' : '/src'
  return process.cwd() + base + subpath
})
```

Then use it with the `--import` flag:

```bash
node --import ./my-aliases.mjs ./app.mjs
```

### CommonJS (older Node 12+ versions)

Add your custom configuration to your `package.json`:

```json
{
  "_moduleAliases": {
    "@root": ".",
    "@deep": "src/some/very/deep/directory/or/file",
    "@my_module": "lib/some-file.js"
  },
  "_moduleDirectories": ["node_modules_custom"]
}
```

Then add this line at the very main file of your app, before any code:

```js
require('module-alias/register')
```

Now you can use aliases:

```js
require('something')
const module = require('@root/some-module')
const veryDeepModule = require('@deep/my-module')
```

## Programmatic CommonJS usage

If you don't want to modify your `package.json` or you just prefer to set it all up programmatically, then the following methods are available for you:

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

## Usage with Webpack

Luckily, WebPack has a built in support for aliases and custom modules directories so it's easy to make it work on the client side as well!

```js
// webpack.config.js
const npm_package = require('./package.json')

module.exports = {
  entry: { ... },
  resolve: {
    root: __dirname,
    alias: npm_package._moduleAliases || {},
    modules: npm_package._moduleDirectories || [] // eg: ["node_modules", "node_modules_custom", "src"]
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

More details on the [official documentation](https://jestjs.io/docs/en/configuration#modulenamemapper-objectstring-string--arraystring).

## Using within another NPM package

You can use `module-alias` within another NPM package, however there are a few things to take into consideration.

1. As the aliases are global, you should make sure your aliases are unique, to avoid conflicts with end-user code, or with other libraries using module-alias. For example, you could prefix your aliases with '@my-lib/', and then use require('@my-lib/deep').
2. The internal "register" mechanism may not work, you should not rely on `require('module-alias/register')` for automatic detection of `package.json` location (where you defined your aliases), as it tries to find package.json in either the current working directory of your node process, or two levels down from node_modules/module-alias. It is extremely likely that this is end-user code. So, instead, your should either register aliases manually with `moduleAlias.addAlias`, or using something like `require('module-alias')(__dirname)`.

Here is an [example project](https://github.com/Kehrlann/module-alias-library).

## Known incompatibilities

This module does not play well with:

- Front-end JavaScript code. Module-alias is designed for server side so do not expect it to work with front-end frameworks (React, Vue, ...) as they tend to use Webpack. Use Webpack's [resolve.alias](https://webpack.js.org/configuration/resolve/#resolvealias) mechanism instead.
- [Jest](https://jestjs.io), which discards node's module system entirely to use it's own module system, bypassing module-alias.
- The [NCC compiler](https://github.com/zeit/ncc), as it uses WebPack under the hood without exposing properties, such as resolve.alias. It is not [something they wish to do](https://github.com/zeit/ncc/pull/460).

## Refactor your code (for already existing projects)

If you are using this on an existing project, you can use [relative-to-alias](https://github.com/s-yadav/relative-to-alias) to refactor your code to start using aliases.

## Special Thanks

Special thanks to [Artur Havrylov](https://github.com/artnikbrothers) and [Daniel Garnier-Moiroux](https://www.npmjs.com/~kehrlann) for valuable contributions.

[npm-image]: https://img.shields.io/npm/v/module-alias.svg
[npm-url]: https://npmjs.org/package/module-alias
[travis-image]: https://img.shields.io/travis/ilearnio/module-alias/master.svg
[travis-url]: https://travis-ci.org/ilearnio/module-alias
