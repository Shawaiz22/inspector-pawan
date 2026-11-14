import type { NormalizedRow, Pollutant } from "../types";

/** One value for one pollutant at one location and time. `value` is null when missing. */
export interface Reading {
  row: number;
  location: string;
  timestamp: string | null;
  value: number | null;
}

/** Readings for one location and pollutant, in time order (undated rows last). */
export interface ReadingSeries {
  location: string;
  pollutant: Pollutant;
  readings: Reading[];
}

/** Key for a single reading, used in exclusion sets. */
export function readingKey(row: number, pollutant: Pollutant): string {
  return `${row}:${pollutant}`;
}

function compareReadings(a: Reading, b: Reading): number {
  if (a.timestamp === b.timestamp) return a.row - b.row;
  if (a.timestamp === null) return 1;
  if (b.timestamp === null) return -1;
  return a.timestamp < b.timestamp ? -1 : 1;
}

/**
 * Groups rows into one series per location and pollutant in a single pass.
 * Series come out in first-seen location order, each sorted by time.
 */
export function groupSeries(rows: NormalizedRow[], pollutants: readonly Pollutant[]): ReadingSeries[] {
  const series = new Map<string, ReadingSeries>();
  for (const row of rows) {
    for (const pollutant of pollutants) {
      const key = `${row.location}\u0000${pollutant}`;
      let entry = series.get(key);
      if (!entry) {
        entry = { location: row.location, pollutant, readings: [] };
        series.set(key, entry);
      }
      entry.readings.push({ row: row.row, location: row.location, timestamp: row.timestamp, value: row.values[pollutant] });
    }
  }
  for (const entry of series.values()) entry.readings.sort(compareReadings);
  return [...series.values()];
}

/** Median of a non-empty list. Returns null for an empty list. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Rounds to one decimal place for display and storage. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
