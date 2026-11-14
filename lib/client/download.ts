import type { NormalizedRow, QualityFlag } from "../types";

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Cleaned rows as CSV: one line per upload row with its row number, canonical
 * values (ug/m3), and the data problems flagged on it.
 */
export function cleanedRowsCsv(rows: NormalizedRow[], flags: QualityFlag[]): string {
  const notes = new Map<number, string[]>();
  for (const flag of flags) {
    const label = flag.pollutant ? `${flag.kind} (${flag.pollutant === "pm25" ? "PM2.5" : "PM10"})` : flag.kind;
    for (const row of flag.rows) notes.set(row, [...(notes.get(row) ?? []), label]);
  }
  const header = ["row", "location", "timestamp", "pm25_ug_m3", "pm10_ug_m3", "lat", "lng", "data_problems"];
  const lines = rows.map((row) =>
    [row.row, row.location, row.timestamp, row.values.pm25, row.values.pm10, row.lat, row.lng, (notes.get(row.row) ?? []).join("; ")]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Saves text as a file in the browser. */
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
