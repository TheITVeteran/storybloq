import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { writeConfig, writeRoadmap } from "./project-loader.js";
import { ProjectLoaderError, CURRENT_SCHEMA_VERSION } from "./errors.js";
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

  return {
    root: absRoot,
    created: [
      ".story/config.json",
      ".story/roadmap.json",
      ".story/tickets/",
      ".story/issues/",
      ".story/handovers/",
    ],
  };
}
