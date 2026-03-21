import { mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeConfig, writeRoadmap, loadProject } from "./project-loader.js";
import { ProjectLoaderError, CURRENT_SCHEMA_VERSION, INTEGRITY_WARNING_TYPES } from "./errors.js";
import type { Config } from "../models/config.js";
import type { Roadmap } from "../models/roadmap.js";

export interface InitOptions {
  name: string;
  force?: boolean;
  type?: string;
  language?: string;
}

export interface InitResult {
  readonly root: string;
  readonly created: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Scaffolds a new .story/ directory structure.
 * Refuses if .story/ already exists unless force is true.
 * Force mode overwrites config.json + roadmap.json only — preserves existing data files.
 */
export async function initProject(
  root: string,
  options: InitOptions,
): Promise<InitResult> {
  const absRoot = resolve(root);
  const wrapDir = join(absRoot, ".story");

  // Check if already exists
  let exists = false;
  try {
    const s = await stat(wrapDir);
    if (s.isDirectory()) exists = true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ProjectLoaderError(
        "io_error",
        `Cannot check .story/ directory: ${(err as Error).message}`,
        err,
      );
    }
  }

  if (exists && !options.force) {
    throw new ProjectLoaderError(
      "conflict",
      ".story/ already exists. Use --force to overwrite config and roadmap.",
    );
  }

  // Create directories
  await mkdir(join(wrapDir, "tickets"), { recursive: true });
  await mkdir(join(wrapDir, "issues"), { recursive: true });
  await mkdir(join(wrapDir, "handovers"), { recursive: true });

  const created: string[] = [
    ".story/config.json",
    ".story/roadmap.json",
    ".story/tickets/",
    ".story/issues/",
    ".story/handovers/",
  ];

  // Today's date
  const today = new Date().toISOString().slice(0, 10);

  const config: Config = {
    version: 2,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: options.name,
    type: options.type ?? "generic",
    language: options.language ?? "unknown",
    features: {
      tickets: true,
      issues: true,
      handovers: true,
      roadmap: true,
      reviews: true,
    },
  };

  const roadmap: Roadmap = {
    title: options.name,
    date: today,
    phases: [
      {
        id: "p0",
        label: "PHASE 0",
        name: "Setup",
        description: "Initial project setup.",
      },
    ],
    blockers: [],
  };

  await writeConfig(config, absRoot);
  await writeRoadmap(roadmap, absRoot);

  // Scaffold Claude Code /prime skill (only on fresh init, not --force)
  const skillDir = join(absRoot, ".claude", "skills", "prime");
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    await mkdir(skillDir, { recursive: true });
    await writeFile(skillPath, PRIME_SKILL_CONTENT, "utf-8");
    created.push(".claude/skills/prime/SKILL.md");
  }

  // Validate existing data files when force-reinitializing.
  // Uses loadProject (permissive) — catches both JSON parse errors AND Zod schema
  // violations, matching exactly what strict mode will reject on future writes.
  const warnings: string[] = [];
  if (options.force && exists) {
    try {
      const { warnings: loadWarnings } = await loadProject(absRoot);
      for (const w of loadWarnings) {
        if ((INTEGRITY_WARNING_TYPES as readonly string[]).includes(w.type)) {
          warnings.push(`${w.file}: ${w.message}`);
        }
      }
    } catch {
      // loadProject may throw on critical file errors (config/roadmap) —
      // we just wrote those, so this shouldn't happen, but don't let
      // validation failures block init.
    }
  }

  return {
    root: absRoot,
    created,
    warnings,
  };
}

// --- Skill Content ---

const PRIME_SKILL_CONTENT = `---
name: prime
description: Load full claudestory project context. Use at session start for any project with a .story/ directory.
---

# Prime: Load Project Context

Get full project context in one command for any project using claudestory.

## Step 0: Check Setup

First, check if the claudestory MCP tools are available by looking for \`claudestory_status\` in your available tools.

**If MCP tools ARE available**, proceed to Step 1.

**If MCP tools are NOT available**, help the user set up:

1. Check if the \`claudestory\` CLI is installed by running: \`claudestory --version\`
2. If NOT installed, tell the user:
   \`\`\`
   claudestory CLI not found. To set up:
   npm install -g @anthropologies/claudestory
   claude mcp add claudestory -s user -- claudestory --mcp
   Then restart Claude Code and run /prime again.
   \`\`\`
3. If CLI IS installed but MCP not registered, offer to register it for them.
   With user permission, run: \`claude mcp add claudestory -s user -- claudestory --mcp\`
   Tell the user to restart Claude Code and run /prime again.

**If MCP tools are unavailable and user doesn't want to set up**, fall back to CLI:
- Run \`claudestory status\` via Bash
- Run \`claudestory recap\` via Bash
- Run \`claudestory handover latest\` via Bash
- Then continue to Steps 4-6 below.

## Step 1: Project Status
Call the \`claudestory_status\` MCP tool.

## Step 2: Session Recap
Call the \`claudestory_recap\` MCP tool.

## Step 3: Latest Handover
Call the \`claudestory_handover_latest\` MCP tool.

## Step 4: Development Rules
Read \`RULES.md\` if it exists in the project root.

## Step 5: Lessons Learned
Read \`WORK_STRATEGIES.md\` if it exists in the project root.

## Step 6: Recent Commits
Run \`git log --oneline -10\`.

## After Loading

Present a concise summary:
- Project progress (X/Y tickets, current phase)
- What changed since last snapshot
- What the last session accomplished
- Next ticket to work on
- Any high-severity issues or blockers
- Key process rules (if WORK_STRATEGIES.md exists)

Then ask: "What would you like to work on?"
`;

