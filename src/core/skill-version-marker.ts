/**
 * ISS-570 G3: Skill-dir version marker + silent auto-refresh.
 *
 * The /story skill lives at ~/.claude/skills/story/. After `storybloq
 * setup-skill`, the skill contains a copy of SKILL.md, setup-flow.md,
 * autonomous-mode.md, reference.md, and review-lenses content from
 * whichever version of the CLI wrote them.
 *
 * When a user runs `npm install -g @storybloq/storybloq@latest`, the CLI
 * binary updates but the skill dir stays on the OLD skill files until
 * `storybloq setup-skill` is re-run. Easy to forget.
 *
 * This module writes a small `.storybloq-version` text file into the
 * skill dir recording the CLI version that generated it. On every CLI
 * invocation, we compare that marker to the running CLI version; if
 * they differ, we re-copy the skill files silently and write a single
 * stderr line noting what happened.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MARKER_FILE = ".storybloq-version";

function skillDir(): string {
  return join(homedir(), ".claude", "skills", "story");
}

function markerPath(): string {
  return join(skillDir(), MARKER_FILE);
}

/** Read the CLI version that last wrote the skill dir. null if missing. */
export function readSkillMarker(): string | null {
  try {
    const p = markerPath();
    if (!existsSync(p)) return null;
    const text = readFileSync(p, "utf-8").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Write the CLI version marker. Best-effort; errors are swallowed. */
export function writeSkillMarker(version: string): void {
  try {
    mkdirSync(skillDir(), { recursive: true });
    writeFileSync(markerPath(), version + "\n", "utf-8");
  } catch {
    // Marker write is best-effort.
  }
}

/** True when the skill dir exists AND the marker is stale or missing. */
export function isSkillStale(runningVersion: string): boolean {
  if (!runningVersion || runningVersion === "0.0.0-dev") return false;
  if (!existsSync(join(skillDir(), "SKILL.md"))) return false; // no skill dir = not stale, just uninstalled
  const marker = readSkillMarker();
  return marker !== runningVersion;
}

/**
 * Silently refresh skill files when the marker is stale.
 *
 * Returns true if a refresh was performed, false otherwise. Prints one
 * line to stderr on success so users see what happened without being
 * spammed with the full setup-skill output.
 *
 * Errors are logged to stderr but do not throw -- a stale skill dir is
 * a UX degradation, not a blocker. The user's original command still
 * runs.
 */
export async function autoRefreshSkillIfStale(runningVersion: string): Promise<boolean> {
  if (!isSkillStale(runningVersion)) return false;

  try {
    const { copyDirRecursive, resolveSkillSourceDir } = await import("../cli/commands/setup-skill.js");
    const src = resolveSkillSourceDir();
    await copyDirRecursive(src, skillDir());
    writeSkillMarker(runningVersion);
    process.stderr.write(
      `storybloq: refreshed /story skill files at ~/.claude/skills/story/ to match CLI v${runningVersion}\n`,
    );
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `storybloq: skill refresh failed (non-fatal): ${msg}\n` +
      `  Run 'storybloq setup-skill' manually to sync.\n`,
    );
    return false;
  }
}
