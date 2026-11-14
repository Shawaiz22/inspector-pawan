import type { NormalizedRow } from "../types";

/** Canonical text of normalized rows: one line per row, fixed field order. */
export function canonicalRows(rows: NormalizedRow[]): string {
  return rows
    .map((row) => [row.row, row.location, row.timestamp ?? "", row.values.pm25 ?? "", row.values.pm10 ?? "", row.lat ?? "", row.lng ?? ""].join("\t"))
    .join("\n");
}

/** Hex SHA-256 of any text, via Web Crypto (browser and Node). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 fingerprint of normalized rows. Same data, same fingerprint, so stats can be reused. */
export function fingerprintRows(rows: NormalizedRow[]): Promise<string> {
  return sha256Hex(canonicalRows(rows));
}
