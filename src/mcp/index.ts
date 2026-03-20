#!/usr/bin/env node
/**
 * claudestory MCP server entry point.
 *
 * Provides 15 read-only tools for querying .story/ project state.
 * Uses direct handler imports — no subprocess spawning.
 * Stdio transport: reads JSON-RPC from stdin, writes to stdout.
 * All diagnostic output goes to stderr.
 */
import { realpathSync, existsSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { discoverProjectRoot } from "../core/project-root-discovery.js";
import { registerAllTools } from "./tools.js";

const ENV_VAR = "CLAUDESTORY_PROJECT_ROOT";
const CONFIG_PATH = ".story/config.json";

// Version injected at build time by tsup define
const version = process.env.CLAUDESTORY_VERSION ?? "0.0.0-dev";

/**
 * Pin project root at startup.
 * CLAUDESTORY_PROJECT_ROOT env var (strongly recommended for MCP) or cwd walk-up.
 */
function pinProjectRoot(): string {
  const envRoot = process.env[ENV_VAR];
  if (envRoot) {
    if (!isAbsolute(envRoot)) {
      process.stderr.write(`Error: ${ENV_VAR} must be an absolute path, got: ${envRoot}\n`);
      process.exit(1);
    }
    const resolved = resolve(envRoot);
    let canonical: string;
    try {
      canonical = realpathSync(resolved);
    } catch {
      process.stderr.write(`Error: ${ENV_VAR} path does not exist: ${resolved}\n`);
      process.exit(1);
    }
    if (!existsSync(join(canonical, CONFIG_PATH))) {
      process.stderr.write(`Error: No .story/config.json at ${canonical}\n`);
      process.exit(1);
    }
    return canonical;
  }

  // Walk-up from cwd (fallback — discouraged for MCP since server cwd is often tool-managed)
  const root = discoverProjectRoot();
  if (!root) {
    process.stderr.write("Error: No .story/ project found. Set CLAUDESTORY_PROJECT_ROOT or run from a project directory.\n");
    process.exit(1);
  }
  return realpathSync(root);
}

async function main(): Promise<void> {
  const root = pinProjectRoot();

  const server = new McpServer(
    { name: "claudestory", version },
    {
      instructions: "Start with claudestory_status for a project overview, then claudestory_ticket_next for the highest-priority work, then claudestory_handover_latest for session context.",
    },
  );

  registerAllTools(server, root);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`claudestory MCP server running (root: ${root})\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
