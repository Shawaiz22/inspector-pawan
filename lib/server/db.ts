import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { BriefSnapshot, CaseAction, LocationStats, LocalHotspot, RepairLogEntry, Role } from "../types";
import { readServerEnv } from "./env";
import { StorageError } from "./errors";

type Sql = NeonQueryFunction<false, false>;
let client: Sql | null | undefined;

/** The Neon client, or null when DATABASE_URL is missing so callers fall back to browser storage. */
export function getSql(): Sql | null {
  if (client === undefined) {
    const url = readServerEnv().databaseUrl;
    client = url ? neon(url) : null;
  }
  return client;
}

async function run<T>(sql: Sql, text: string, params: unknown[]): Promise<T[]> {
  try {
    return (await sql.query(text, params)) as T[];
  } catch {
    throw new StorageError();
  }
}

/** A workspace as stored. */
export interface WorkspaceRecord {
  id: string;
  token_hash: string;
  role: Role;
  name: string;
  role_note: string | null;
  places: string[];
  created_at: string;
}

/** Inserts a workspace and returns its id. */
export async function insertWorkspace(
  sql: Sql,
  input: { tokenHash: string; role: Role; name: string; roleNote: string | null; places: string[] },
): Promise<string> {
  const rows = await run<{ id: string }>(
    sql,
    "INSERT INTO workspaces (token_hash, role, name, role_note, places) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id",
    [input.tokenHash, input.role, input.name, input.roleNote, JSON.stringify(input.places)],
  );
  return rows[0].id;
}

/** Loads a workspace by id, or null. */
export async function findWorkspace(sql: Sql, id: string): Promise<WorkspaceRecord | null> {
  const rows = await run<WorkspaceRecord>(sql, "SELECT * FROM workspaces WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Updates workspace settings. Only the given fields change. */
export async function updateWorkspace(
  sql: Sql,
  id: string,
  input: { role?: Role; name?: string; roleNote?: string | null; places?: string[] },
): Promise<WorkspaceRecord | null> {
  const rows = await run<WorkspaceRecord>(
    sql,
    `UPDATE workspaces SET
       role = COALESCE($2, role),
       name = COALESCE($3, name),
       role_note = CASE WHEN $4::boolean THEN $5 ELSE role_note END,
       places = COALESCE($6::jsonb, places)
     WHERE id = $1 RETURNING *`,
    [
      id,
      input.role ?? null,
      input.name ?? null,
      input.roleNote !== undefined,
      input.roleNote ?? null,
      input.places ? JSON.stringify(input.places) : null,
    ],
  );
  return rows[0] ?? null;
}

/** What a stored brief holds. */
export interface StoredBriefInput {
  workspaceId: string;
  fingerprint: string;
  periodStart: string | null;
  periodEnd: string | null;
  locations: string[];
  stats: { stats: LocationStats[]; hotspots: LocalHotspot[] };
  brief: unknown;
  actions: CaseAction[];
  repairs: RepairLogEntry[];
}

/** Stores a brief and returns its id and creation time. */
export async function insertBrief(sql: Sql, input: StoredBriefInput): Promise<{ id: string; createdAt: string }> {
  const rows = await run<{ id: string; created_at: string }>(
    sql,
    `INSERT INTO briefs (workspace_id, fingerprint, period_start, period_end, locations, stats, brief, actions, repairs)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb) RETURNING id, created_at`,
    [
      input.workspaceId,
      input.fingerprint,
      input.periodStart,
      input.periodEnd,
      input.locations,
      JSON.stringify(input.stats),
      JSON.stringify(input.brief),
      JSON.stringify(input.actions),
      JSON.stringify(input.repairs),
    ],
  );
  return { id: rows[0].id, createdAt: rows[0].created_at };
}

interface BriefRow {
  id: string;
  period_start: string | null;
  period_end: string | null;
  locations: string[];
  stats: { stats: LocationStats[]; hotspots: LocalHotspot[] };
  created_at: string;
}

function localTimestamp(value: string | Date | null): string | null {
  if (value === null) return null;
  return new Date(value).toISOString().slice(0, 16);
}

/** A past brief usable for compare. */
export interface PastBrief {
  id: string;
  createdAt: string;
  snapshot: BriefSnapshot;
}

function toPastBrief(row: BriefRow): PastBrief {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    snapshot: {
      periodStart: localTimestamp(row.period_start),
      periodEnd: localTimestamp(row.period_end),
      locations: row.locations,
      stats: row.stats.stats,
      hotspots: row.stats.hotspots,
    },
  };
}

/** The previous brief: a chosen one, or the latest of the workspace. */
export async function findPreviousBrief(sql: Sql, workspaceId: string, briefId?: string): Promise<PastBrief | null> {
  const rows = briefId
    ? await run<BriefRow>(sql, "SELECT id, period_start, period_end, locations, stats, created_at FROM briefs WHERE workspace_id = $1 AND id = $2", [workspaceId, briefId])
    : await run<BriefRow>(sql, "SELECT id, period_start, period_end, locations, stats, created_at FROM briefs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1", [workspaceId]);
  return rows[0] ? toPastBrief(rows[0]) : null;
}

/** Recent briefs of a workspace, newest first, for the compare picker. */
export async function listBriefs(
  sql: Sql,
  workspaceId: string,
): Promise<Array<{ id: string; createdAt: string; periodStart: string | null; periodEnd: string | null; locations: string[] }>> {
  const rows = await run<BriefRow>(
    sql,
    "SELECT id, period_start, period_end, locations, created_at FROM briefs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 20",
    [workspaceId],
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    periodStart: localTimestamp(row.period_start),
    periodEnd: localTimestamp(row.period_end),
    locations: row.locations,
  }));
}

/** Stores a published notice. */
export async function insertNotice(
  sql: Sql,
  input: { slug: string; workspaceId: string; briefId: string | null; area: string; content: unknown },
): Promise<string> {
  const rows = await run<{ published_at: string }>(
    sql,
    "INSERT INTO notices (slug, workspace_id, brief_id, area, content) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING published_at",
    [input.slug, input.workspaceId, input.briefId, input.area, JSON.stringify(input.content)],
  );
  return new Date(rows[0].published_at).toISOString();
}

/** Loads a published notice by slug, or null. */
export async function findNotice(
  sql: Sql,
  slug: string,
): Promise<{ slug: string; area: string; content: unknown; publishedAt: string } | null> {
  const rows = await run<{ slug: string; area: string; content: unknown; published_at: string }>(
    sql,
    "SELECT slug, area, content, published_at FROM notices WHERE slug = $1",
    [slug],
  );
  const row = rows[0];
  return row ? { slug: row.slug, area: row.area, content: row.content, publishedAt: new Date(row.published_at).toISOString() } : null;
}
