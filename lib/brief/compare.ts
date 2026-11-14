import { STEADY_BAND } from "../data/stats";
import { round1 } from "../data/readings";
import type { BriefSnapshot, CompareResult, LocationStats, StatChange } from "../types";

/** Below this share of shared locations, briefs are not compared. */
export const MIN_OVERLAP = 0.5;

function statsKey(location: string, pollutant: string): string {
  return `${location.toLowerCase()}\u0000${pollutant}`;
}

function indexStats(stats: LocationStats[]): Map<string, LocationStats> {
  return new Map(stats.map((entry) => [statsKey(entry.location, entry.pollutant), entry]));
}

function directionOf(change: number): StatChange["direction"] {
  if (Math.abs(change) <= STEADY_BAND) return "steady";
  return change < 0 ? "improved" : "worsened";
}

function relativeChange(before: number, after: number): number {
  if (before === 0) return after === 0 ? 0 : 1;
  return Math.round(((after - before) / before) * 1000) / 1000;
}

/**
 * Compares a new brief with the previous one from the same workspace, in code.
 * Needs at least half of the previous locations to be present again. Reports
 * per-location changes (within 10% is steady), new and missing locations,
 * and hotspots that appeared or resolved.
 */
export function compareBriefs(previous: BriefSnapshot, current: BriefSnapshot): CompareResult {
  const currentLocations = new Map(current.locations.map((name) => [name.toLowerCase(), name]));
  const previousLocations = new Set(previous.locations.map((name) => name.toLowerCase()));
  let shared = 0;
  for (const name of previousLocations) if (currentLocations.has(name)) shared += 1;
  const overlap = previousLocations.size > 0 ? round1((shared / previousLocations.size) * 100) / 100 : 0;

  if (overlap < MIN_OVERLAP) {
    return { status: "different_areas", overlap, message: "This data covers different areas, so a new series was started. Pick another past brief to compare." };
  }

  const previousStats = indexStats(previous.stats);
  const currentStats = indexStats(current.stats);
  const changes: StatChange[] = [];
  for (const [key, before] of previousStats) {
    const after = currentStats.get(key);
    if (!after || before.mean === null || after.mean === null) continue;
    const change = relativeChange(before.mean, after.mean);
    changes.push({
      location: after.location,
      pollutant: after.pollutant,
      meanBefore: before.mean,
      meanAfter: after.mean,
      maxBefore: before.max?.value ?? null,
      maxAfter: after.max?.value ?? null,
      change,
      direction: directionOf(change),
    });
  }

  const previousHotspots = new Set(previous.hotspots.map((spot) => spot.location));
  const currentHotspots = new Set(current.hotspots.map((spot) => spot.location));

  return {
    status: "compared",
    overlap,
    notNewer: Boolean(previous.periodEnd && current.periodStart && current.periodStart <= previous.periodEnd),
    changes,
    newLocations: current.locations.filter((name) => !previousLocations.has(name.toLowerCase())),
    missingLocations: previous.locations.filter((name) => !currentLocations.has(name.toLowerCase())),
    hotspotsAppeared: [...currentHotspots].filter((name) => !previousHotspots.has(name)),
    hotspotsResolved: [...previousHotspots].filter((name) => !currentHotspots.has(name)),
  };
}
