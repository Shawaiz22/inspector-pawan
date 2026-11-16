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

/** An access code record stored in PostgreSQL. */
export interface AccessCodeRecord {
  id: string;
  email: string;
  code_hash: string;
  code_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
}

/** Idempotently creates the access_codes table and index if missing. */
export async function ensureAccessCodeTable(sql: Sql): Promise<void> {
  await run(
    sql,
    `CREATE TABLE IF NOT EXISTS access_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      code_hash text NOT NULL UNIQUE,
      code_prefix text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    )`,
    [],
  );
  await run(
    sql,
    `CREATE INDEX IF NOT EXISTS access_codes_email_idx ON access_codes (email)`,
    [],
  );
}

/** Inserts a new access code record. */
export async function insertAccessCode(
  sql: Sql,
  input: { email: string; codeHash: string; codePrefix: string; metadata?: Record<string, unknown> },
): Promise<AccessCodeRecord> {
  await ensureAccessCodeTable(sql);
  const rows = await run<AccessCodeRecord>(
    sql,
    `INSERT INTO access_codes (email, code_hash, code_prefix, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [input.email.toLowerCase().trim(), input.codeHash, input.codePrefix, JSON.stringify(input.metadata ?? {})],
  );
  return rows[0];
}

/** Looks up an active access code by its SHA-256 hash. */
export async function findActiveAccessCode(sql: Sql, codeHash: string): Promise<AccessCodeRecord | null> {
  await ensureAccessCodeTable(sql);
  const rows = await run<AccessCodeRecord>(
    sql,
    "SELECT * FROM access_codes WHERE code_hash = $1 AND is_active = true",
    [codeHash],
  );
  return rows[0] ?? null;
}

/** Updates the last_used_at timestamp on an access code. */
export async function touchAccessCode(sql: Sql, id: string): Promise<void> {
  await run(
    sql,
    "UPDATE access_codes SET last_used_at = now() WHERE id = $1",
    [id],
  );
}

/** Finds the most recent active access code for an email. */
export async function findLatestAccessCodeByEmail(sql: Sql, email: string): Promise<AccessCodeRecord | null> {
  await ensureAccessCodeTable(sql);
  const rows = await run<AccessCodeRecord>(
    sql,
    "SELECT * FROM access_codes WHERE email = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1",
    [email.toLowerCase().trim()],
  );
  return rows[0] ?? null;
}
