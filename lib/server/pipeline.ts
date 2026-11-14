import "server-only";
import { analyzeRows } from "../data/analyze";
import { fingerprintRows } from "../data/fingerprint";
import { POLLUTANTS } from "../data/naqi";
import { normalizeTable, type NormalizeResult } from "../data/normalize";
import { detectColumns, missingRequiredFields, parseTable } from "../data/parse";
import type { ColumnMap, DatasetAnalysis, Pollutant, RawTable, RepairProposal } from "../types";
import { LruCache } from "./cache";
import { ValidationError } from "./errors";

const analysisCache = new LruCache<DatasetAnalysis>(100);

/** Parses the text and settles the column map (given map wins, then detection). */
export function readTable(text: string, columns?: ColumnMap): { table: RawTable; map: ColumnMap } {
  const table = parseTable(text);
  return { table, map: columns && Object.keys(columns).length > 0 ? columns : detectColumns(table.headers) };
}

/** A cleaned and analysed dataset. */
export interface PreparedCase {
  normalized: NormalizeResult;
  analysis: DatasetAnalysis;
  fingerprint: string;
  reused: boolean;
}

/**
 * Applies the accepted repairs and analyses the rows. Analysis is reused when
 * the same normalized rows (same fingerprint) were seen before.
 * @throws ValidationError when required columns are missing or no rows remain
 */
export async function prepareCase(
  table: RawTable,
  map: ColumnMap,
  proposals: RepairProposal[],
  accepted: ReadonlySet<string>,
): Promise<PreparedCase> {
  const missing = missingRequiredFields(map);
  if (missing.length > 0) throw new ValidationError(`Could not find these columns: ${missing.join(", ")}. Check the column mapping.`);
  const normalized = normalizeTable(table, map, proposals, accepted);
  if (normalized.rows.length === 0) throw new ValidationError("No rows with a location were found.");
  const pollutants: Pollutant[] = POLLUTANTS.filter((pollutant) => map[pollutant] !== undefined);
  const fingerprint = await fingerprintRows(normalized.rows);
  const cacheKey = `${fingerprint}:${pollutants.join(",")}:${normalized.flags.map((flag) => `${flag.kind}${flag.rows.length}`).join(",")}`;
  const cached = analysisCache.get(cacheKey);
  if (cached) return { normalized, analysis: cached, fingerprint, reused: true };
  const analysis = analyzeRows(normalized.rows, pollutants, normalized.flags);
  analysisCache.set(cacheKey, analysis);
  return { normalized, analysis, fingerprint, reused: false };
}
