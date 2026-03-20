import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const fixturesDir = resolve(__dirname, "fixtures");

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}
