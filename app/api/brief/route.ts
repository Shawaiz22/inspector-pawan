import { connection } from "next/server";
import { briefRequest } from "@/lib/api/schemas";
import { generateJson } from "@/lib/ai/gemini";
import { briefPrompt } from "@/lib/ai/prompts";
import { briefResponse } from "@/lib/ai/schemas";
import { libraryForRole, validateActions } from "@/lib/brief/actions";
import { compareBriefs } from "@/lib/brief/compare";
import { assembleFindings } from "@/lib/brief/findings";
import { buildRowIndex } from "@/lib/brief/verify";
import { findPreviousBrief, getSql, insertBrief } from "@/lib/server/db";
import { authorizeWorkspace, handle, readJson } from "@/lib/server/http";
import { prepareCase, readTable } from "@/lib/server/pipeline";
import { RateLimiter } from "@/lib/server/rateLimit";
import type { BriefSnapshot, CompareResult, DatasetAnalysis, RepairProposal, Role } from "@/lib/types";

export const maxDuration = 180;

const limiter = new RateLimiter(10, 60_000);

function snapshotOf(analysis: DatasetAnalysis): BriefSnapshot {
  return {
    periodStart: analysis.periodStart,
    periodEnd: analysis.periodEnd,
    locations: analysis.locations,
    stats: analysis.stats,
    hotspots: analysis.hotspots,
  };
}

/** Builds the case: repairs, stats, events, Gemini brief and audit, verification, actions, compare, storage. */
export function POST(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    await connection();
    const body = await readJson(request, briefRequest);
    const stored = body.workspaceId ? await authorizeWorkspace(request, body.workspaceId) : null;
    const profile = stored
      ? { role: stored.role as Role, name: stored.name, roleNote: stored.role_note, places: stored.places }
      : body.workspace;

    const { table, map } = readTable(body.text, body.columns);
    const proposals: RepairProposal[] = body.proposals;
    const prepared = await prepareCase(table, map, proposals, new Set(body.accepted));
    const { analysis, normalized } = prepared;

    const sql = getSql();
    const past = stored && sql ? await findPreviousBrief(sql, stored.id, body.previousBriefId) : null;
    const previous = past?.snapshot ?? (body.previous as unknown as BriefSnapshot | undefined) ?? null;
    const compare: CompareResult | null = previous ? compareBriefs(previous, snapshotOf(analysis)) : null;

    const rowIndex = buildRowIndex(normalized.rows);
    const written = await generateJson({
      call: "brief",
      prompt: briefPrompt({
        analysis,
        role: profile.role,
        roleNote: profile.roleNote,
        area: profile.name,
        places: profile.places,
        library: libraryForRole(profile.role),
        changes: compare && compare.status === "compared" ? { changes: compare.changes, newLocations: compare.newLocations, missingLocations: compare.missingLocations } : null,
      }),
      schema: briefResponse,
      temperature: 0.2,
    });

    const findings = assembleFindings(written, rowIndex, analysis);
    const { accepted: actions, rejected: rejectedActions } = validateActions(written.actions, {
      role: profile.role,
      analysis,
      rowIndex,
      places: profile.places,
    });

    const snapshot = snapshotOf(analysis);
    let saved: { id: string; createdAt: string } | null = null;
    if (stored && sql) {
      saved = await insertBrief(sql, {
        workspaceId: stored.id,
        fingerprint: prepared.fingerprint,
        periodStart: analysis.periodStart ? `${analysis.periodStart}:00Z` : null,
        periodEnd: analysis.periodEnd ? `${analysis.periodEnd}:00Z` : null,
        locations: analysis.locations,
        stats: { stats: analysis.stats, hotspots: analysis.hotspots },
        brief: { headline: written.headline, summary: written.summary, findings, rejectedActions },
        actions,
        repairs: normalized.ledger,
      });
    }

    return Response.json({
      briefId: saved?.id ?? null,
      createdAt: saved?.createdAt ?? new Date().toISOString(),
      fingerprint: prepared.fingerprint,
      statsReused: prepared.reused,
      headline: written.headline,
      summary: written.summary,
      findings,
      actions,
      rejectedActions,
      compare,
      analysis,
      rows: normalized.rows,
      ledger: normalized.ledger,
      snapshot,
    });
  });
}
