'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Validates that a target path is safely within the given workspace root.
 * Throws an E_PATH_OUT_OF_BOUNDS error if it escapes.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace root.
 * @param {string} targetPath - The path to validate (can be relative or absolute).
 * @returns {string} The resolved absolute path, guaranteed to be inside workspaceRoot.
 */
function enforceBoundary(workspaceRoot, targetPath) {
    if (!workspaceRoot) {
        throw new Error('Workspace root is not defined.');
    }

    // Resolve workspaceRoot to an absolute, normalized path
    const safeRoot = path.resolve(workspaceRoot);

    // Resolve targetPath against the workspace root
    // If targetPath is already absolute (e.g., C:\foo or /foo), path.resolve will just use it.
    // If targetPath is relative, it will join it to safeRoot.
    let resolvedTarget = path.resolve(safeRoot, targetPath);

    // Check if the resolvedTarget starts with the safeRoot
    // We add path.sep to ensure /var/www-safe is not matched as inside /var/www
    const rootWithSep = safeRoot.endsWith(path.sep) ? safeRoot : safeRoot + path.sep;
    
    // Exact match of the root itself is also valid (e.g. if targetPath is ".")
    if (resolvedTarget !== safeRoot && !resolvedTarget.startsWith(rootWithSep)) {
        const error = new Error(`E_PATH_OUT_OF_BOUNDS: Path "${targetPath}" resolves outside of workspace "${safeRoot}". Access denied.`);
        error.code = 'E_PATH_OUT_OF_BOUNDS';
        throw error;
    }

    return resolvedTarget;
}

module.exports = {
    enforceBoundary
};
