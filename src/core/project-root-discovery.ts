import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const ENV_VAR = "CLAUDESTORY_PROJECT_ROOT";
const CONFIG_PATH = ".story/config.json";

/**
 * Discovers the project root by walking up from `startDir` (default: cwd)
 * looking for `.story/config.json`.
 *
 * CLAUDESTORY_PROJECT_ROOT env var overrides walk-up discovery.
 * Returns the canonical absolute path, or null if not found.
 */
export function discoverProjectRoot(startDir?: string): string | null {
  // 1. Check env var override
  const envRoot = process.env[ENV_VAR];
  if (envRoot) {
    const resolved = resolve(envRoot);
    if (existsSync(join(resolved, CONFIG_PATH))) {
      return resolved;
    }
    return null;
  }

  // 2. Walk up from startDir
  let current = resolve(startDir ?? process.cwd());

  for (;;) {
    if (existsSync(join(current, CONFIG_PATH))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break; // filesystem root reached
    current = parent;
  }

  return null;
}
