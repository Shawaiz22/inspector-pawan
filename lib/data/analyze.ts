import { buildAvoidAdvice } from "../brief/avoid";
import type { DatasetAnalysis, NormalizedRow, Pollutant, QualityFlag } from "../types";
import { findEventSlots, findHotspots, indexSlots, mergeEventSlots } from "./events";
import { checkQuality, excludedReadings } from "./quality";
import { groupSeries } from "./readings";
import { computeStats } from "./stats";

/**
 * Runs every code check on cleaned rows: quality flags, citywide events,
 * local hotspots, per-location stats and avoid advice. Rows are grouped once
 * and every later step reuses those series.
 * @param pollutants the pollutant columns present in the upload
 * @param cleaningFlags flags raised while normalizing (bad dates, unit mismatches)
 */
export function analyzeRows(
  rows: NormalizedRow[],
  pollutants: readonly Pollutant[],
  cleaningFlags: QualityFlag[] = [],
): DatasetAnalysis {
  const series = groupSeries(rows, pollutants);
  const flags = [...cleaningFlags, ...checkQuality(series)];
  const excluded = excludedReadings(flags);

  const locations: string[] = [];
  const seenLocations = new Set<string>();
  const timestamps = new Set<string>();
  const coordinates: DatasetAnalysis["coordinates"] = {};
  for (const row of rows) {
    if (!seenLocations.has(row.location)) {
      seenLocations.add(row.location);
      locations.push(row.location);
    }
    if (row.timestamp) timestamps.add(row.timestamp);
    if (row.lat !== null && row.lng !== null && !coordinates[row.location]) {
      coordinates[row.location] = { lat: row.lat, lng: row.lng };
    }
  }
  const timeline = [...timestamps].sort();

  const slotIndex = indexSlots(series, excluded);
  const eventSlots = findEventSlots(slotIndex);
  const events = mergeEventSlots(eventSlots, timeline, slotIndex);
  const eventTimes = new Set(eventSlots.map((slot) => slot.timestamp));
  const stats = computeStats(series, excluded, eventTimes);

  return {
    rowCount: rows.length,
    locations,
    timestamps: timeline,
    periodStart: timeline[0] ?? null,
    periodEnd: timeline[timeline.length - 1] ?? null,
    coordinates,
    flags,
    stats,
    events,
    eventSlots,
    hotspots: findHotspots(slotIndex, eventTimes),
    avoid: buildAvoidAdvice(stats, events),
  };
}
