import type { OutputFormat, ErrorCode } from "../models/types.js";
import type { Ticket } from "../models/ticket.js";
import type { Issue } from "../models/issue.js";
import type { Roadmap } from "../models/roadmap.js";
import type { ProjectState } from "./project-state.js";
import type { LoadWarning } from "./errors.js";
import type { ValidationResult } from "./validation.js";
import type { NextTicketOutcome } from "./queries.js";
import { phasesWithStatus, isBlockerCleared } from "./queries.js";

// --- Exit Codes ---

export const ExitCode = {
  OK: 0,
  USER_ERROR: 1,
  VALIDATION_ERROR: 2,
  PARTIAL: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

// --- JSON Envelopes ---

export interface SuccessEnvelope<T> {
  readonly version: 1;
  readonly data: T;
}

export interface ErrorEnvelope {
  readonly version: 1;
  readonly error: { readonly code: ErrorCode; readonly message: string };
}

export interface PartialEnvelope<T> {
  readonly version: 1;
  readonly data: T;
  readonly warnings: readonly { type: string; file: string; message: string }[];
  readonly partial: true;
}

export function successEnvelope<T>(data: T): SuccessEnvelope<T> {
  return { version: 1, data };
}

export function errorEnvelope(
  code: ErrorCode,
  message: string,
): ErrorEnvelope {
  return { version: 1, error: { code, message } };
}

export function partialEnvelope<T>(
  data: T,
  warnings: readonly LoadWarning[],
): PartialEnvelope<T> {
  return {
    version: 1,
    data,
    warnings: warnings.map((w) => ({
      type: w.type,
      file: w.file,
      message: w.message,
    })),
    partial: true,
  };
}

// --- Markdown Safety ---

/**
 * Escapes characters that would create Markdown structure in inline text.
 * Handles heading, list, blockquote, ordered list at line start.
 * Handles inline structural characters.
 */
export function escapeMarkdownInline(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([`*_~\[\]()|])/g, "\\$1")
    .replace(/(^|\n)([#\-+*])/g, "$1\\$2")
    .replace(/(^|\n)(\d+)\./g, "$1$2\\.");
}

/**
 * Wraps multi-line content in a fenced code block.
 * Uses a fence length longer than any backtick sequence in the content.
 */
export function fencedBlock(content: string, lang?: string): string {
  let maxTicks = 2;
  const matches = content.match(/`+/g);
  if (matches) {
    for (const m of matches) {
      if (m.length > maxTicks) maxTicks = m.length;
    }
  }
  const fence = "`".repeat(maxTicks + 1);
  return `${fence}${lang ?? ""}\n${content}\n${fence}`;
}

// --- Format Functions ---

export function formatStatus(
  state: ProjectState,
  format: OutputFormat,
): string {
  const phases = phasesWithStatus(state);
  const data = {
    project: state.config.project,
    totalTickets: state.totalTicketCount,
    completeTickets: state.completeTicketCount,
    openTickets: state.openTicketCount,
    blockedTickets: state.blockedCount,
    openIssues: state.openIssueCount,
    handovers: state.handoverFilenames.length,
    phases: phases.map((p) => ({
      id: p.phase.id,
      name: p.phase.name,
      status: p.status,
      leafCount: p.leafCount,
    })),
  };

  if (format === "json") {
    return JSON.stringify(successEnvelope(data), null, 2);
  }

  const lines: string[] = [
    `# ${escapeMarkdownInline(state.config.project)}`,
    "",
    `Tickets: ${state.completeTicketCount}/${state.totalTicketCount} complete, ${state.blockedCount} blocked`,
    `Issues: ${state.openIssueCount} open`,
    `Handovers: ${state.handoverFilenames.length}`,
    "",
    "## Phases",
    "",
  ];
  for (const p of phases) {
    const indicator = p.status === "complete" ? "[x]" : p.status === "inprogress" ? "[~]" : "[ ]";
    const summary = p.phase.summary ?? truncate(p.phase.description, 80);
    lines.push(`${indicator} **${escapeMarkdownInline(p.phase.name)}** (${p.leafCount} tickets) — ${escapeMarkdownInline(summary)}`);
  }

  return lines.join("\n");
}

export function formatPhaseList(
  state: ProjectState,
  format: OutputFormat,
): string {
  const phases = phasesWithStatus(state);
  const data = phases.map((p) => ({
    id: p.phase.id,
    label: p.phase.label,
    name: p.phase.name,
    description: p.phase.summary ?? p.phase.description,
    status: p.status,
    leafCount: p.leafCount,
  }));

  if (format === "json") {
    return JSON.stringify(successEnvelope(data), null, 2);
  }

  const lines: string[] = [];
  for (const p of data) {
    const indicator = p.status === "complete" ? "[x]" : p.status === "inprogress" ? "[~]" : "[ ]";
    lines.push(`${indicator} **${escapeMarkdownInline(p.name)}** (${p.id}) — ${p.leafCount} tickets — ${escapeMarkdownInline(truncate(p.description, 80))}`);
  }
  return lines.join("\n");
}

export function formatPhaseTickets(
  phaseId: string,
  state: ProjectState,
  format: OutputFormat,
): string {
  const tickets = state.phaseTickets(phaseId);
  if (format === "json") {
    return JSON.stringify(successEnvelope(tickets), null, 2);
  }
  if (tickets.length === 0) return "No tickets in this phase.";
  return tickets.map((t) => formatTicketOneLiner(t, state)).join("\n");
}

export function formatTicket(
  ticket: Ticket,
  state: ProjectState,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(ticket), null, 2);
  }

  const blocked = state.isBlocked(ticket) ? " [BLOCKED]" : "";
  const lines: string[] = [
    `# ${escapeMarkdownInline(ticket.id)}: ${escapeMarkdownInline(ticket.title)}${blocked}`,
    "",
    `Status: ${ticket.status} | Type: ${ticket.type} | Phase: ${ticket.phase ?? "none"} | Order: ${ticket.order}`,
    `Created: ${ticket.createdDate}${ticket.completedDate ? ` | Completed: ${ticket.completedDate}` : ""}`,
  ];
  if (ticket.blockedBy.length > 0) {
    lines.push(`Blocked by: ${ticket.blockedBy.join(", ")}`);
  }
  if (ticket.parentTicket) {
    lines.push(`Parent: ${ticket.parentTicket}`);
  }
  if (ticket.description) {
    lines.push("", "## Description", "", fencedBlock(ticket.description));
  }
  return lines.join("\n");
}

export function formatNextTicketOutcome(
  outcome: NextTicketOutcome,
  state: ProjectState,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(outcome), null, 2);
  }

  switch (outcome.kind) {
    case "empty_project":
      return "No phased tickets found.";

    case "all_complete":
      return "All phases complete.";

    case "all_blocked": {
      return `All ${outcome.blockedCount} incomplete tickets in phase "${escapeMarkdownInline(outcome.phaseId)}" are blocked.`;
    }

    case "found": {
      const t = outcome.ticket;
      const lines: string[] = [
        `# Next: ${escapeMarkdownInline(t.id)} — ${escapeMarkdownInline(t.title)}`,
        "",
        `Phase: ${t.phase ?? "none"} | Order: ${t.order} | Type: ${t.type}`,
      ];

      if (outcome.unblockImpact.wouldUnblock.length > 0) {
        const ids = outcome.unblockImpact.wouldUnblock.map((u) => u.id).join(", ");
        lines.push(`Completing this unblocks: ${ids}`);
      }

      if (outcome.umbrellaProgress) {
        const p = outcome.umbrellaProgress;
        lines.push(`Parent progress: ${p.complete}/${p.total} complete (${p.status})`);
      }

      if (t.description) {
        lines.push("", fencedBlock(t.description));
      }

      return lines.join("\n");
    }
  }
}

export function formatTicketList(
  tickets: readonly Ticket[],
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(tickets), null, 2);
  }
  if (tickets.length === 0) return "No tickets found.";
  const lines: string[] = [];
  for (const t of tickets) {
    const status = t.status === "complete" ? "[x]" : t.status === "inprogress" ? "[~]" : "[ ]";
    lines.push(`${status} ${t.id}: ${escapeMarkdownInline(t.title)} (${t.phase ?? "none"})`);
  }
  return lines.join("\n");
}

export function formatIssue(
  issue: Issue,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(issue), null, 2);
  }

  const lines: string[] = [
    `# ${escapeMarkdownInline(issue.id)}: ${escapeMarkdownInline(issue.title)}`,
    "",
    `Status: ${issue.status} | Severity: ${issue.severity}`,
    `Components: ${issue.components.join(", ") || "none"}`,
    `Discovered: ${issue.discoveredDate}${issue.resolvedDate ? ` | Resolved: ${issue.resolvedDate}` : ""}`,
  ];
  if (issue.relatedTickets.length > 0) {
    lines.push(`Related: ${issue.relatedTickets.join(", ")}`);
  }
  lines.push("", "## Impact", "", fencedBlock(issue.impact));
  if (issue.resolution) {
    lines.push("", "## Resolution", "", fencedBlock(issue.resolution));
  }
  return lines.join("\n");
}

export function formatIssueList(
  issues: readonly Issue[],
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(issues), null, 2);
  }
  if (issues.length === 0) return "No issues found.";
  const lines: string[] = [];
  for (const i of issues) {
    const status = i.status === "resolved" ? "[x]" : "[ ]";
    lines.push(`${status} ${i.id} [${i.severity}]: ${escapeMarkdownInline(i.title)}`);
  }
  return lines.join("\n");
}

export function formatBlockedTickets(
  tickets: readonly Ticket[],
  state: ProjectState,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(
      successEnvelope(
        tickets.map((t) => ({
          ...t,
          blockers: t.blockedBy.map((bid) => ({
            id: bid,
            status: state.ticketByID(bid)?.status ?? "unknown",
          })),
        })),
      ),
      null,
      2,
    );
  }
  if (tickets.length === 0) return "No blocked tickets.";
  const lines: string[] = [];
  for (const t of tickets) {
    const blockerInfo = t.blockedBy
      .map((bid) => {
        const b = state.ticketByID(bid);
        return b ? `${bid} (${b.status})` : `${bid} (unknown)`;
      })
      .join(", ");
    lines.push(`${t.id}: ${escapeMarkdownInline(t.title)} — blocked by: ${blockerInfo}`);
  }
  return lines.join("\n");
}

export function formatValidation(
  result: ValidationResult,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(result), null, 2);
  }

  const lines: string[] = [
    result.valid ? "Validation passed." : "Validation failed.",
    `Errors: ${result.errorCount} | Warnings: ${result.warningCount} | Info: ${result.infoCount}`,
  ];

  if (result.findings.length > 0) {
    lines.push("");
    for (const f of result.findings) {
      const prefix = f.level === "error" ? "ERROR" : f.level === "warning" ? "WARN" : "INFO";
      const entity = f.entity ? `[${escapeMarkdownInline(f.entity)}] ` : "";
      lines.push(`${prefix}: ${entity}${escapeMarkdownInline(f.message)}`);
    }
  }

  return lines.join("\n");
}

export function formatBlockerList(
  roadmap: Roadmap,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(
      successEnvelope(
        roadmap.blockers.map((b) => ({
          name: b.name,
          cleared: isBlockerCleared(b),
          note: b.note ?? null,
          createdDate: b.createdDate ?? null,
          clearedDate: b.clearedDate ?? null,
        })),
      ),
      null,
      2,
    );
  }

  if (roadmap.blockers.length === 0) return "No blockers.";
  const lines: string[] = [];
  for (const b of roadmap.blockers) {
    const status = isBlockerCleared(b) ? "[x]" : "[ ]";
    const note = b.note ? ` — ${escapeMarkdownInline(b.note)}` : "";
    lines.push(`${status} ${escapeMarkdownInline(b.name)}${note}`);
  }
  return lines.join("\n");
}

export function formatError(
  code: ErrorCode,
  message: string,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(errorEnvelope(code, message), null, 2);
  }
  return `Error [${code}]: ${escapeMarkdownInline(message)}`;
}

export function formatInitResult(
  result: { root: string; created: readonly string[] },
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(result), null, 2);
  }
  return [`Initialized .story/ at ${escapeMarkdownInline(result.root)}`, "", ...result.created.map((f) => `  ${f}`)].join("\n");
}

export function formatHandoverList(
  filenames: readonly string[],
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope(filenames), null, 2);
  }
  if (filenames.length === 0) return "No handovers found.";
  return filenames.join("\n");
}

export function formatHandoverContent(
  filename: string,
  content: string,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(successEnvelope({ filename, content }), null, 2);
  }
  // MD mode: raw content as-is (it's already markdown)
  return content;
}

// --- Private Helpers ---

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function formatTicketOneLiner(t: Ticket, state: ProjectState): string {
  const status = t.status === "complete" ? "[x]" : t.status === "inprogress" ? "[~]" : "[ ]";
  const blocked = state.isBlocked(t) ? " [BLOCKED]" : "";
  return `${status} ${t.id}: ${escapeMarkdownInline(t.title)}${blocked}`;
}
