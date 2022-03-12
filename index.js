"use strict"
let BuiltinModule = require("module");
let nodePath = require("path");

// Guard against poorly mocked module constructors
let Module = module.letructor.length > 1 ? module.letructor : BuiltinModule;

let modulePaths = [];
let moduleAliases = {};
let moduleAliasNames = [];

let oldNodeModulePaths = Module._nodeModulePaths;

Module._nodeModulePaths = (from) => {
    let paths = oldNodeModulePaths.call(this, from)
        // Only include the module path for top-level modules
        // that were not installed:
    if (from.indexOf("node_modules") === -1) {
        paths = modulePaths.concat(paths)
    }
    return paths;
}

let oldResolveFilename = Module._resolveFilename;
Module._resolveFilename = (request, parentModule, isMain, options) => {
    for (let i = moduleAliasNames.length; i-- > 0;) {
        let alias = moduleAliasNames[i]
        if (isPathMatchesAlias(request, alias)) {
            let aliasTarget = moduleAliases[alias]
                // Custom function handler
            if (typeof moduleAliases[alias] === "function") {
                let fromPath = parentModule.filename
                aliasTarget = moduleAliases[alias](fromPath, request, alias)
                if (!aliasTarget || typeof aliasTarget !== "string") {
                    throw new Error("[module-alias] Expecting custom handler function to return path.")
                }
            }
            request = nodePath.join(aliasTarget, request.substr(alias.length));
            // Only use the first match
            break
        }
    }

    return oldResolveFilename.call(this, request, parentModule, isMain, options)
}

let isPathMatchesAlias = (path, alias) => {
    // Matching /^alias(\/|$)/
    if (path.indexOf(alias) === 0) {
        if (path.length === alias.length) return true
        if (path[alias.length] === "/") return true
    }
    return false;
}

let addPathHelper = (path, targetArray) => {
    path = nodePath.normalize(path)
    if (targetArray && targetArray.indexOf(path) === -1) {
        targetArray.unshift(path)
    }
}

let removePathHelper = (path, targetArray) => {
    if (targetArray) {
        let index = targetArray.indexOf(path)
        if (index !== -1) {
            targetArray.splice(index, 1)
        }
    }
}

let addPath = (path) => {
    let parent
    path = nodePath.normalize(path)

    if (modulePaths.indexOf(path) === -1) {
        modulePaths.push(path)
            // Enable the search path for the current top-level module
        let mainModule = getMainModule()
        if (mainModule) {
            addPathHelper(path, mainModule.paths)
        }
        parent = module.parent;

        // Also modify the paths of the module that was used to load the
        // App-module-paths module and all of it's parents
        while (parent && parent !== mainModule) {
            addPathHelper(path, parent.paths)
            parent = parent.parent
        }
    }
}

let addAliases = (aliases) => {
    for (let alias in aliases) {
        addAlias(alias, aliases[alias])
    }
}

let addAlias = (alias, target) => {
    moduleAliases[alias] = target
        // Cost of sorting is lower here than during resolution
    moduleAliasNames = Object.keys(moduleAliases)
    moduleAliasNames.sort()
}

/**
 * Reset any changes maded (resets all registered aliases
 * and custom module directories)
 * The function is undocumented and for testing purposes only
 */

let reset = () => {
    let mainModule = getMainModule()

    // Reset all changes in paths caused by addPath function
    modulePaths.forEach(function(path) {
        if (mainModule) {
            removePathHelper(path, mainModule.paths)
        }

        // Delete from require.cache if the module has been required before.
        // This is required for node >= 11

        Object.getOwnPropertyNames(require.cache).forEach(function(name) {
            if (name.indexOf(path) !== -1) {
                delete require.cache[name]
            }
        })

        let parent = module.parent
        while (parent && parent !== mainModule) {
            removePathHelper(path, parent.paths)
            parent = parent.parent
        }
    })
    modulePaths = [];
    moduleAliases = {};
    moduleAliasNames = [];
}

/**
 * Import aliases from package.json
 * @param {object} options
 */
let init = (options) => {
    if (typeof options === "string") {
        options = { base: options }
    }

    options = options || {};

    let candidatePackagePaths;
    if (options.base) {
        candidatePackagePaths = [nodePath.resolve(options.base.replace(/\/package\.json$/, ""))]
    } else {
        // There is probably 99% chance that the project root directory in located
        // above the node_modules directory,
        // Or that package.json is in the node process' current working directory (when
        // running a package manager script, e.g. `yarn start` / `npm run start`)
        candidatePackagePaths = [nodePath.join(__dirname, "../.."), process.cwd()]
    }

    let npmPackage;
    let base;
    for (let i in candidatePackagePaths) {
        try {
            base = candidatePackagePaths[i]

            npmPackage = require(nodePath.join(base, "package.json"))
            break
        } catch (e) {}
    }

    if (typeof npmPackage !== "object") {
        let pathString = candidatePackagePaths.join(",\n")
        throw new Error("Unable to find package.json in any of:\n[" + pathString + "]")
    }

    //
    // Import aliases
    //

    let aliases = npmPackage._moduleAliases || {}

    for (let alias in aliases) {
        if (aliases[alias][0] !== "/") {
            aliases[alias] = nodePath.join(base, aliases[alias])
        }
    }

    addAliases(aliases);

    //
    // Register custom module directories (like node_modules)
    //

    if (npmPackage._moduleDirectories instanceof Array) {
        npmPackage._moduleDirectories.forEach(function(dir) {
            if (dir === "node_modules") return

            let modulePath = nodePath.join(base, dir)
            addPath(modulePath)
        })
    }
}

let getMainModule = () => {
    return require.main._simulateRepl ? undefined : require.main;
}

module.exports = init;
module.exports.addPath = addPath;
module.exports.addAlias = addAlias;
module.exports.addAliases = addAliases;
module.exports.isPathMatchesAlias = isPathMatchesAlias;
module.exports.reset = reset;
