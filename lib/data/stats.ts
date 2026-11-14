import { confidenceFor } from "../brief/confidence";
import type { HourBucket, LocationStats, TimeWindow } from "../types";
import { categoryFor, isAtLeast } from "./naqi";
import { readingKey, round1, type ReadingSeries } from "./readings";

/** Changes within this fraction count as steady. */
export const STEADY_BAND = 0.1;
/** Width of a time-of-day window, in hours. */
export const WINDOW_HOURS = 2;

/** Hour of day (0-23) from a "YYYY-MM-DDTHH:mm" timestamp. */
export function hourOf(timestamp: string): number {
  return Number(timestamp.slice(11, 13));
}

/** Start hour of the 2-hour bucket a timestamp falls in. */
export function bucketStart(timestamp: string): number {
  return Math.floor(hourOf(timestamp) / WINDOW_HOURS) * WINDOW_HOURS;
}

function trendOf(values: number[]): LocationStats["trend"] {
  if (values.length < 4) return "unknown";
  const half = Math.floor(values.length / 2);
  let firstSum = 0;
  let secondSum = 0;
  for (let index = 0; index < half; index += 1) firstSum += values[index];
  for (let index = values.length - half; index < values.length; index += 1) secondSum += values[index];
  const first = firstSum / half;
  const second = secondSum / half;
  if (first === 0) return second === 0 ? "steady" : "rising";
  const change = (second - first) / first;
  if (Math.abs(change) <= STEADY_BAND) return "steady";
  return change > 0 ? "rising" : "falling";
}

function toWindow(series: ReadingSeries, bucket: HourBucket): TimeWindow {
  return {
    location: series.location,
    pollutant: series.pollutant,
    startHour: bucket.startHour,
    endHour: bucket.startHour + WINDOW_HOURS,
    mean: bucket.mean,
    category: categoryFor(series.pollutant, bucket.mean),
    rows: bucket.rows,
  };
}

/**
 * Computes stats for one series in a single pass: count, missing, mean, max,
 * trend, NAQI category of the mean, confidence, readings at Poor or worse and
 * 2-hour time-of-day buckets. Buckets, and the cleanest and worst windows
 * taken from them, leave out citywide event hours so they show the local pattern.
 */
export function seriesStats(
  series: ReadingSeries,
  excluded: ReadonlySet<string>,
  eventTimes: ReadonlySet<string>,
): LocationStats {
  const { pollutant } = series;
  const ordered: number[] = [];
  const buckets = new Map<number, { sum: number; count: number; rows: number[] }>();
  const poorRows: number[] = [];
  let sum = 0;
  let max: LocationStats["max"] = null;

  for (const reading of series.readings) {
    if (reading.value === null || excluded.has(readingKey(reading.row, pollutant))) continue;
    const value = reading.value;
    sum += value;
    ordered.push(value);
    if (reading.timestamp !== null && (max === null || value > max.value)) {
      max = { value, row: reading.row, timestamp: reading.timestamp };
    }
    if (isAtLeast(categoryFor(pollutant, value), "Poor")) poorRows.push(reading.row);
    if (reading.timestamp === null || eventTimes.has(reading.timestamp)) continue;
    const start = bucketStart(reading.timestamp);
    const bucket = buckets.get(start) ?? { sum: 0, count: 0, rows: [] };
    bucket.sum += value;
    bucket.count += 1;
    bucket.rows.push(reading.row);
    buckets.set(start, bucket);
  }

  const count = ordered.length;
  const missing = series.readings.length - count;
  const mean = count > 0 ? round1(sum / count) : null;
  const hourBuckets: HourBucket[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startHour, bucket]) => ({ startHour, mean: round1(bucket.sum / bucket.count), count: bucket.count, rows: bucket.rows }));

  let cleanest: HourBucket | null = null;
  let worst: HourBucket | null = null;
  for (const bucket of hourBuckets) {
    if (cleanest === null || bucket.mean < cleanest.mean) cleanest = bucket;
    if (worst === null || bucket.mean > worst.mean) worst = bucket;
  }

  return {
    location: series.location,
    pollutant,
    total: series.readings.length,
    count,
    missing,
    mean,
    max,
    category: mean === null ? null : categoryFor(pollutant, mean),
    trend: trendOf(ordered),
    confidence: confidenceFor(count, missing),
    buckets: hourBuckets,
    cleanest: cleanest ? toWindow(series, cleanest) : null,
    worst: worst ? toWindow(series, worst) : null,
    poorOrWorse: { count: poorRows.length, rows: poorRows },
  };
}

/** Stats for every series. */
export function computeStats(
  series: ReadingSeries[],
  excluded: ReadonlySet<string>,
  eventTimes: ReadonlySet<string>,
): LocationStats[] {
  return series.map((entry) => seriesStats(entry, excluded, eventTimes));
}
