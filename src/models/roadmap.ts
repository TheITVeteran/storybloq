import { z } from "zod";
import { DateSchema } from "./types.js";

export const BlockerSchema = z
  .object({
    name: z.string().min(1),
    // Legacy format (pre-T-082)
    cleared: z.boolean().optional(),
    // New date-based format (T-082 migration)
    createdDate: DateSchema.optional(),
    clearedDate: DateSchema.nullable().optional(),
    // Present in all current data but optional for future minimal blockers
    note: z.string().nullable().optional(),
  })
  .passthrough();

export type Blocker = z.infer<typeof BlockerSchema>;

export const PhaseSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    name: z.string(),
    description: z.string(),
    summary: z.string().optional(),
  })
  .passthrough();

export type Phase = z.infer<typeof PhaseSchema>;

export const RoadmapSchema = z
  .object({
    title: z.string(),
    date: DateSchema,
    phases: z.array(PhaseSchema),
    blockers: z.array(BlockerSchema),
  })
  .passthrough();

export type Roadmap = z.infer<typeof RoadmapSchema>;
