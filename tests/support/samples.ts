import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeRows } from "@/lib/data/analyze";
import { POLLUTANTS } from "@/lib/data/naqi";
import { normalizeTable, proposeRepairs } from "@/lib/data/normalize";
import { detectColumns, parseTable } from "@/lib/data/parse";
import type { BriefSnapshot, DatasetAnalysis, NormalizedRow, RepairProposal } from "@/lib/types";

/** Reads a sample CSV from public/samples. */
export function readSample(name: "week1" | "week2"): string {
  return readFileSync(join(process.cwd(), "public", "samples", `ward-aq-${name}.csv`), "utf8");
}

/** A sample run through the full code pipeline with every repair accepted. */
export interface SampleCase {
  proposals: RepairProposal[];
  rows: NormalizedRow[];
  analysis: DatasetAnalysis;
}

/** Parses, repairs (all accepted) and analyses a sample. */
export function loadSample(name: "week1" | "week2"): SampleCase {
  const table = parseTable(readSample(name));
  const map = detectColumns(table.headers);
  const proposals = proposeRepairs(table, map);
  const normalized = normalizeTable(table, map, proposals, new Set(proposals.map((proposal) => proposal.id)));
  return { proposals, rows: normalized.rows, analysis: analyzeRows(normalized.rows, POLLUTANTS, normalized.flags) };
}

/** Builds the snapshot compare needs from an analysis. */
export function snapshotOf(analysis: DatasetAnalysis): BriefSnapshot {
  return {
    periodStart: analysis.periodStart,
    periodEnd: analysis.periodEnd,
    locations: analysis.locations,
    stats: analysis.stats,
    hotspots: analysis.hotspots,
  };
}
