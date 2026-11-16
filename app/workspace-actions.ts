"use server";

import type { BriefResult, PlaceEntry, Profile } from "@/lib/api/types";
import {
  findFullCaseBrief,
  getSql,
  insertWorkspace,
  listCasesByWorkspace,
  listWorkspacesByOwner,
  type CaseSummary,
} from "@/lib/server/db";
import { getActiveSession } from "@/lib/server/session";
import { createToken, hashToken } from "@/lib/server/token";

export interface UserWorkspaceSummary {
  id: string;
  role: Profile["role"];
  name: string;
  roleNote: string | null;
  places: PlaceEntry[];
  createdAt: string;
}

/** Lists all workspaces owned by the logged-in user. */
export async function listUserWorkspaces(): Promise<UserWorkspaceSummary[]> {
  const session = await getActiveSession();
  if (!session || !session.email) return [];

  const sql = getSql();
  if (!sql) return [];

  try {
    const records = await listWorkspacesByOwner(sql, session.email);
    return records.map((w) => ({
      id: w.id,
      role: w.role,
      name: w.name,
      roleNote: w.role_note,
      places: w.places || [],
      createdAt: new Date(w.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Lists historical cases for a given workspace. */
export async function listWorkspaceCases(workspaceId: string): Promise<CaseSummary[]> {
  const sql = getSql();
  if (!sql || !workspaceId) return [];

  try {
    return await listCasesByWorkspace(sql, workspaceId);
  } catch {
    return [];
  }
}

/** Reconstructs and returns the full BriefResult for any past case. */
export async function loadHistoricalCase(
  workspaceId: string,
  briefId: string,
): Promise<BriefResult | null> {
  const sql = getSql();
  if (!sql || !workspaceId || !briefId) return null;

  try {
    return await findFullCaseBrief(sql, workspaceId, briefId);
  } catch {
    return null;
  }
}

/** Creates a workspace linked to the logged-in user's email. */
export async function saveWorkspaceForUser(
  profile: Profile,
): Promise<{ id: string | null; token: string | null }> {
  const session = await getActiveSession();
  const ownerEmail = session?.email ?? null;

  const sql = getSql();
  if (!sql) return { id: null, token: null };

  const token = createToken();
  const id = await insertWorkspace(sql, {
    tokenHash: hashToken(token),
    role: profile.role,
    name: profile.name,
    roleNote: profile.roleNote,
    places: profile.places,
    ownerEmail,
  });

  return { id, token };
}
