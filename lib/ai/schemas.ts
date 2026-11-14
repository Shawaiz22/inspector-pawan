import { z } from "zod";

const pollutant = z.enum(["pm25", "pm10"]);
const rows = z.array(z.number().int().positive()).max(60);
const columnIndex = z.number().int().min(0).nullable();

/** Gemini call 1: header mapping and repair proposals. */
export const columnRepairResponse = z.object({
  columns: z.object({
    location: columnIndex,
    date: columnIndex,
    time: columnIndex,
    datetime: columnIndex,
    pm25: columnIndex,
    pm10: columnIndex,
    lat: columnIndex,
    lng: columnIndex,
  }),
  proposals: z
    .array(
      z.object({
        op: z.enum(["scale", "date_order", "mark_missing"]),
        field: pollutant.nullable(),
        factor: z.number().positive().nullable(),
        order: z.enum(["dmy", "mdy"]).nullable(),
        token: z.string().max(40).nullable(),
        rows: z.array(z.number().int().positive()).max(5000),
        description: z.string().max(200),
        example: z.string().max(200),
      }),
    )
    .max(10),
  notes: z.string().max(400),
});
export type ColumnRepairResponse = z.infer<typeof columnRepairResponse>;

/** Gemini call 2: findings and case-plan actions. */
export const briefResponse = z.object({
  headline: z.string().max(200),
  summary: z.string().max(1200),
  findings: z
    .array(
      z.object({
        kind: z.enum(["trend", "hotspot", "event", "data_gap", "window"]),
        title: z.string().max(160),
        detail: z.string().max(600),
        location: z.string().max(120).nullable(),
        pollutant: pollutant.nullable(),
        rows,
      }),
    )
    .max(8),
  actions: z
    .array(
      z.object({
        libraryId: z.string().max(60),
        title: z.string().max(200),
        when: z.string().max(120),
        where: z.string().max(120),
        why: z.string().max(400),
        followUp: z.string().max(300),
        rows,
        target: z.object({
          location: z.string().max(120),
          startHour: z.number().int(),
          endHour: z.number().int(),
          pollutant,
        }),
        letter: z.object({ to: z.string().max(120), subject: z.string().max(160), body: z.string().max(2000) }).nullable(),
      }),
    )
    .max(8),
});
export type BriefResponse = z.infer<typeof briefResponse>;

/** Gemini call 3: audit of each finding against the stats. */
export const auditResponse = z.object({
  audits: z
    .array(
      z.object({
        index: z.number().int().min(0),
        status: z.enum(["supported", "overstated", "unsupported"]),
        note: z.string().max(300),
      }),
    )
    .max(8),
});
export type AuditResponse = z.infer<typeof auditResponse>;

const careText = z.string().max(600);

/** Gemini call 4: internal note and citizen notice for one language and level. */
export const advisoryResponse = z.object({
  internalNote: z.object({ title: z.string().max(160), body: z.string().max(3000) }),
  notice: z.object({
    headline: z.string().max(200),
    summary: z.string().max(800),
    care: z.object({ children: careText, olderAdults: careText, sensitive: careText, everyone: careText }),
    avoid: z.array(z.object({ index: z.number().int().min(0), advice: z.string().max(300) })).max(20),
  }),
});
export type AdvisoryResponse = z.infer<typeof advisoryResponse>;
