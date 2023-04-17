// The vault controller file
// Maintains the VFS of the vaults.
// Contains functions for validating paths and associating paths with the
// respective Files or Directories.

import path from "path";
import fs from "fs/promises";
import { File, Directory } from "./vfs.js";
import { generateVFS } from "./vfs_helpers.js";

export type ValidatedPath = string & { __type: "ValidatedPath" };

/**
 * Allowed characters: Alpha numerical, "_", "-", ".", " "
 * Names consisting only of dots and spaces not allowed.
 */
const validNameRegex = /(?!^(\.)+$)^(?! |-)[a-zA-Z0-9_\-. ]+(?<! )$/
/**
 * Allowed characters: Alpha numerical, "_", "-", ".", " "
 * Names consisting only of dots and spaces not allowed.
 */
const validPathRegex = /(?!^(\.)+($|\/))^(?! |-)[a-zA-Z0-9_\-. ]+(?<! )(\/(?!(\.)+($|\/))(?! |-)[a-zA-Z0-9_\-. )]+(?<! ))*$/;
const baseVaultDirectory = process.env.VAULT_DIRECTORY || path.join(process.cwd(), "vaults");



export { validNameRegex, validPathRegex };
