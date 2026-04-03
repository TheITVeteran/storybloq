/**
 * Deterministic issue key generation for finding dedup within the synthesizer.
 *
 * Uses DJB2 hash for plan-review fallback keys. Note: this is an independent
 * key space from guide.ts deferral fingerprints (different output format).
 */

import type { LensFinding } from "./types.js";

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

export function generateIssueKey(finding: LensFinding): string {
  if (finding.file && finding.line != null) {
    return `${finding.lens}:${finding.file}:${finding.line}:${finding.category}`;
  }
  // Plan review fallback: no file/line
  const descWords = finding.description.split(/\s+/).slice(0, 20).join(" ");
  return `${finding.lens}:${finding.category}:${djb2(descWords)}`;
}
