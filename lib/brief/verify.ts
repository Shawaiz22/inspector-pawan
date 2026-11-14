import type { NormalizedRow, Pollutant, Verification } from "../types";

/** Rows by row number, for constant-time citation checks. */
export type RowIndex = ReadonlyMap<number, NormalizedRow>;

/** Builds the row index once per dataset. */
export function buildRowIndex(rows: NormalizedRow[]): RowIndex {
  return new Map(rows.map((row) => [row.row, row]));
}

/** What a claim cites: the rows, and optionally the location and pollutant it is about. */
export interface Citation {
  rows: number[];
  location: string | null;
  pollutant: Pollutant | null;
}

function sameLocation(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Checks a citation against the data: there must be cited rows, every row must
 * exist, belong to the named location (when one is named) and hold a reading
 * for the named pollutant (when one is named).
 */
export function verifyCitation(citation: Citation, index: RowIndex): Verification {
  const reasons: string[] = [];
  if (citation.rows.length === 0) reasons.push("No rows are cited.");
  const unknown: number[] = [];
  const elsewhere: number[] = [];
  const empty: number[] = [];
  for (const rowNumber of citation.rows) {
    const row = index.get(rowNumber);
    if (!row) {
      unknown.push(rowNumber);
      continue;
    }
    if (citation.location !== null && !sameLocation(row.location, citation.location)) elsewhere.push(rowNumber);
    if (citation.pollutant !== null && row.values[citation.pollutant] === null) empty.push(rowNumber);
  }
  if (unknown.length > 0) reasons.push(`Rows ${unknown.join(", ")} do not exist in the data.`);
  if (elsewhere.length > 0) reasons.push(`Rows ${elsewhere.join(", ")} are not from ${citation.location}.`);
  if (empty.length > 0) reasons.push(`Rows ${empty.join(", ")} have no reading for this pollutant.`);
  return { verified: reasons.length === 0, reasons };
}

/** True when the location is one of the dataset's locations (case-insensitive). */
export function isKnownLocation(location: string, locations: readonly string[]): boolean {
  return locations.some((known) => sameLocation(known, location));
}
