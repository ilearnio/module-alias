# @ministryofjustice/module-alias

**Module Alias** creates _aliases_ to the location of any package on your file system from configuration in `package.json`.

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
npm i -P @ministryofjustice/module-alias
```

## Usage

Add configuration to `package.json`:

### Aliases

```js
{
  "_moduleAliases": {
    "@root"      : ".",
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

**Module Alias** will resolve the location of `package.json` and register any aliases contained in it before applying the alias to `require` during execution.

### Registering from an _entry point_

Include this line at the top of your _entry point_ JS file:

```js
require('@ministryofjustice/module-alias/register')
```
The path to `package.json` is determined from the location of the _process current working directory_. (Ordinarily, this is _root_ directory of the application.)

### Registering from a _module_

Include this line at the top of _any_ JS file:
```js
require('@ministryofjustice/module-alias/register-module')(module)
```
The path to `package.json` is derived from the location of the _module_. (This is useful when the path to `package.json` cannot be determined from the location of the _process current working directory_.)



## About this package

`@ministryofjustice/module-alias` is a fork of [`module-alias`](https://www.npmjs.com/package/module-alias) with an improved mechanism for resolving the location of `package.json` and the removal of some features we do not use.
