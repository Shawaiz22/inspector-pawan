import { z } from "zod";
import { MAX_TEXT_BYTES } from "../data/parse";
import { ROLE_NOTE_MAX } from "../roles";

const role = z.enum(["ward_officer", "school", "housing_society", "other"]);
const pollutant = z.enum(["pm25", "pm10"]);

const placeCategory = z.enum(["industrial", "construction", "school", "hospital", "commercial", "other"]);

export const structuredPlaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: placeCategory.default("other"),
  customCategory: z.string().trim().max(100).nullable().optional(),
  contact: z.string().trim().max(120).nullable().optional(),
});

export const placeItemSchema = z.union([z.string().trim().min(1).max(120), structuredPlaceSchema]);

/** Workspace profile fields. */
export const workspaceProfile = z.object({
  role,
  name: z.string().trim().min(1).max(120),
  roleNote: z.string().trim().max(ROLE_NOTE_MAX).nullable().default(null),
  places: z.array(placeItemSchema).max(10).default([]),
  ownerEmail: z.string().trim().email().nullable().optional(),
});

/** POST /api/workspace */
export const createWorkspaceRequest = workspaceProfile;
/** PATCH /api/workspace */
export const patchWorkspaceRequest = workspaceProfile.partial();

const tableText = z.string().max(MAX_TEXT_BYTES, "The table is larger than 200 KB.");

/** POST /api/repair */
export const repairRequest = z.object({ text: tableText });

const columnMap = z
  .object({
    location: z.number().int().min(0),
    date: z.number().int().min(0),
    time: z.number().int().min(0),
    datetime: z.number().int().min(0),
    pm25: z.number().int().min(0),
    pm10: z.number().int().min(0),
    lat: z.number().int().min(0),
    lng: z.number().int().min(0),
  })
  .partial();

const repairOperation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("scale"), field: pollutant, factor: z.number().positive().max(1_000_000) }),
  z.object({ op: z.literal("date_order"), order: z.enum(["dmy", "mdy"]) }),
  z.object({ op: z.literal("mark_missing"), field: pollutant, token: z.string().max(40) }),
]);

const repairProposal = z.object({
  id: z.string().max(40),
  source: z.enum(["code", "ai"]),
  operation: repairOperation,
  rows: z.array(z.number().int().positive()).max(5000),
  description: z.string().max(300),
  example: z.string().max(300),
});

const rowList = z.array(z.number().int().positive()).max(5000);

const snapshotStats = z.looseObject({
  location: z.string().max(120),
  pollutant,
  mean: z.number().nullable(),
  max: z.looseObject({ value: z.number() }).nullable(),
  buckets: z.array(z.object({ startHour: z.number().int(), mean: z.number(), count: z.number().int(), rows: rowList })).max(24),
});

/** A previous brief kept in the browser when there is no database. */
export const briefSnapshot = z.object({
  periodStart: z.string().max(20).nullable(),
  periodEnd: z.string().max(20).nullable(),
  locations: z.array(z.string().max(120)).max(200),
  stats: z.array(snapshotStats).max(400),
  hotspots: z.array(z.looseObject({ location: z.string().max(120) })).max(400),
});

/** POST /api/brief */
export const briefRequest = z.object({
  text: tableText,
  columns: columnMap.optional(),
  proposals: z.array(repairProposal).max(30).default([]),
  accepted: z.array(z.string().max(40)).max(30).default([]),
  workspace: workspaceProfile,
  workspaceId: z.uuid().optional(),
  previousBriefId: z.uuid().optional(),
  previous: briefSnapshot.optional(),
});

/** POST /api/advisory */
export const advisoryRequest = z.object({
  language: z.enum(["en", "hi"]),
  level: z.enum(["simple", "detailed"]),
  role,
  area: z.string().trim().min(1).max(120),
  headline: z.string().max(300),
  summary: z.string().max(1500),
  findings: z.array(z.object({ title: z.string().max(200), detail: z.string().max(800) })).max(10),
  actions: z.array(z.object({ title: z.string().max(200), when: z.string().max(160), where: z.string().max(160) })).max(10),
});

const careText = z.string().max(800);

/** Notice content as published. */
export const noticeContent = z.object({
  language: z.enum(["en", "hi"]),
  level: z.enum(["simple", "detailed"]),
  title: z.string().max(200),
  headline: z.string().max(300),
  summary: z.string().max(1000),
  category: z.enum(["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]).nullable(),
  value: z.number().nullable(),
  care: z.object({ children: careText, olderAdults: careText, sensitive: careText, everyone: careText }),
  readings: z.number().int().min(0),
  sensors: z.number().int().min(0),
});

/** POST /api/notices */
export const publishRequest = z.object({
  workspaceId: z.uuid(),
  briefId: z.uuid().nullable().default(null),
  area: z.string().trim().min(1).max(120),
  content: noticeContent,
});
