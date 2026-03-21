#!/usr/bin/env node
/**
 * claudestory MCP server entry point.
 *
 * Provides 19 tools for querying and modifying .story/ project state.
 * Uses direct handler imports — no subprocess spawning.
 * Stdio transport: reads JSON-RPC from stdin, writes to stdout.
 * All diagnostic output goes to stderr.
 *
 * Project root discovery:
 * - CLAUDESTORY_PROJECT_ROOT env var (explicit, highest priority)
 * - Walk-up from cwd to find .story/config.json
 * - If neither found, server still starts — tools return "no project" errors
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
 * Try to discover project root. Returns the root path or null.
 * Never exits — the server stays alive even without a project.
 */
function tryDiscoverRoot(): string | null {
  const envRoot = process.env[ENV_VAR];
  if (envRoot) {
    if (!isAbsolute(envRoot)) {
      process.stderr.write(`Warning: ${ENV_VAR} must be an absolute path, got: ${envRoot}\n`);
      return null;
    }
    const resolved = resolve(envRoot);
    try {
      const canonical = realpathSync(resolved);
      if (existsSync(join(canonical, CONFIG_PATH))) {
        return canonical;
      }
      process.stderr.write(`Warning: No .story/config.json at ${canonical}\n`);
    } catch {
      process.stderr.write(`Warning: ${ENV_VAR} path does not exist: ${resolved}\n`);
    }
    return null;
  }

  try {
    const root = discoverProjectRoot();
    return root ? realpathSync(root) : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const root = tryDiscoverRoot();

  const server = new McpServer(
    { name: "claudestory", version },
    {
      instructions: root
        ? "Start with claudestory_status for a project overview, then claudestory_ticket_next for the highest-priority work, then claudestory_handover_latest for session context."
        : "No .story/ project found in the current directory. Navigate to a project with a .story/ directory, or set CLAUDESTORY_PROJECT_ROOT.",
    },
  );

  if (root) {
    registerAllTools(server, root);
    process.stderr.write(`claudestory MCP server running (root: ${root})\n`);
  } else {
    // Register a single status tool that explains the situation
    server.registerTool("claudestory_status", {
      description: "Project summary — returns error if no .story/ project found",
    }, () => Promise.resolve({
      content: [{ type: "text" as const, text: "No .story/ project found. Navigate to a directory containing .story/ or set CLAUDESTORY_PROJECT_ROOT." }],
      isError: true,
    }));
    process.stderr.write("claudestory MCP server running (no project found — tools will report errors)\n");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
