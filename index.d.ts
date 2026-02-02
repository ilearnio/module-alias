/**
 * Custom resolver function for dynamic alias resolution
 * @param fromPath - Full path of the file from which import/require was called
 * @param request - The full import path (e.g. '@src/utils.js')
 * @param alias - The alias being matched (e.g. '@src')
 * @returns The resolved absolute path
 */
type AliasResolver = (fromPath: string, request: string, alias: string) => string;

/**
 * Register a single alias
 * @param alias - The alias to register (e.g. '@utils')
 * @param target - The target path or a resolver function
 */
export function addAlias(alias: string, target: string | AliasResolver): void;

/**
 * Register multiple aliases at once
 * @param aliases - Object mapping aliases to target paths or resolver functions
 */
export function addAliases(aliases: Record<string, string | AliasResolver>): void;

/**
 * Register a custom module directory (like node_modules)
 * @param path - The directory path to add
 */
export function addPath(path: string): void;

/**
 * Reset all registered aliases and paths
 */
export function reset(): void;

/**
 * Initialize module-alias from a package.json file
 * @param options - Path to package.json or options object
 */
declare function moduleAlias(options?: string | { base?: string }): void;

export default moduleAlias;
