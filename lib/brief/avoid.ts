import { categoryFor, isAtLeast, worseCategory } from "../data/naqi";
import { WINDOW_HOURS } from "../data/stats";
import type { AqiCategory, AvoidAdvice, EventWindow, LocationStats, Pollutant } from "../types";

interface BadBucket {
  category: AqiCategory;
  pollutants: Set<Pollutant>;
  rows: number[];
}

function badBucketsByLocation(stats: LocationStats[]): Map<string, Map<number, BadBucket>> {
  const byLocation = new Map<string, Map<number, BadBucket>>();
  for (const entry of stats) {
    for (const bucket of entry.buckets) {
      const category = categoryFor(entry.pollutant, bucket.mean);
      if (!isAtLeast(category, "Poor")) continue;
      const buckets = byLocation.get(entry.location) ?? new Map<number, BadBucket>();
      const existing = buckets.get(bucket.startHour);
      if (existing) {
        existing.category = worseCategory(existing.category, category);
        existing.pollutants.add(entry.pollutant);
        existing.rows.push(...bucket.rows);
      } else {
        buckets.set(bucket.startHour, { category, pollutants: new Set([entry.pollutant]), rows: [...bucket.rows] });
      }
      byLocation.set(entry.location, buckets);
    }
  }
  return byLocation;
}

function toAdvice(location: string, startHour: number, endHour: number, parts: BadBucket[]): AvoidAdvice {
  let category: AqiCategory = "Poor";
  const pollutants = new Set<Pollutant>();
  const rows = new Set<number>();
  for (const part of parts) {
    category = worseCategory(category, part.category);
    for (const pollutant of part.pollutants) pollutants.add(pollutant);
    for (const row of part.rows) rows.add(row);
  }
  return {
    kind: "local",
    location,
    startHour,
    endHour,
    start: null,
    end: null,
    category,
    pollutants: [...pollutants].sort(),
    rows: [...rows].sort((a, b) => a - b),
  };
}

/**
 * Builds "when to limit time outdoors" advice from computed data only:
 * per location, the daily windows (outside citywide events) where any pollutant
 * averaged Poor or worse, joined when back to back; plus every citywide event
 * episode. Each item keeps its rows. No routes are suggested: there is no data
 * between sensor points.
 */
export function buildAvoidAdvice(stats: LocationStats[], events: EventWindow[]): AvoidAdvice[] {
  const advice: AvoidAdvice[] = [];
  for (const [location, buckets] of badBucketsByLocation(stats)) {
    const starts = [...buckets.keys()].sort((a, b) => a - b);
    let spanStart = starts[0];
    let parts: BadBucket[] = [];
    for (let index = 0; index < starts.length; index += 1) {
      const start = starts[index];
      const bucket = buckets.get(start);
      if (!bucket) continue;
      parts.push(bucket);
      const next = starts[index + 1];
      if (next !== start + WINDOW_HOURS) {
        advice.push(toAdvice(location, spanStart, start + WINDOW_HOURS, parts));
        spanStart = next;
        parts = [];
      }
    }
  }
  for (const event of events) {
    advice.push({
      kind: "citywide",
      location: null,
      startHour: null,
      endHour: null,
      start: event.start,
      end: event.end,
      category: event.category,
      pollutants: event.pollutants,
      rows: event.rows,
    });
  }
  return advice;
}
