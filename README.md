# @ministryofjustice/module-alias

Map package aliases and directories to their location of the file system, with configuration in `package.json`.

Not:

```js
require('../../../../some/very/deep/module')
```

But:
```js
const module = require('@deep/module')
```

Or you can register _directories_ that will behave like `node_modules`.

## Install

```
npm i @ministryofjustice/module-alias
```

## Usage

Add configuration to `package.json`:

### Aliases

```js
{
  "_moduleAliases": {
    "@root"      : ".", // Application's root
    "@deep"      : "src/some/very/deep/directory/or/file",
    "@my_module" : "lib/some-file.js",
    "something"  : "src/foo"
  }
}
```

### Directories
```js
{
  "_moduleDirectories": [
    "src/node_modules_custom"
  ]
}

```

Then include this line at the top of your module:

```js
require('module-alias/register')
```

`@ministryofjustice/module-alias` will resolve the location of `package.json` and register any aliases contained in it before applying the alias to any `require` calls made by your module.

## About this package

`@ministryofjustice/module-alias` is a fork of [`module-alias`](https://www.npmjs.com/package/module-alias) with an improved mechanism for resolving the location of `package.json` and the removal of some features we do not use (such as custom handlers).
