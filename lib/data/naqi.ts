import type { AqiCategory, Pollutant } from "../types";

/** CPCB NAQI categories, cleanest first. */
export const AQI_CATEGORIES: readonly AqiCategory[] = [
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
];

/** Upper bounds (inclusive, ug/m3) of each category below Severe, 24h breakpoints. */
const UPPER_BOUNDS: Record<Pollutant, readonly number[]> = {
  pm25: [30, 60, 90, 120, 250],
  pm10: [50, 100, 250, 350, 430],
};

/** Human label for each pollutant. */
export const POLLUTANT_LABELS: Record<Pollutant, string> = { pm25: "PM2.5", pm10: "PM10" };

/** All pollutants the app scores. */
export const POLLUTANTS: readonly Pollutant[] = ["pm25", "pm10"];

/**
 * NAQI sub-index category for a concentration. Hourly values use the 24h
 * breakpoints, so callers must label the result "indicative".
 */
export function categoryFor(pollutant: Pollutant, value: number): AqiCategory {
  const bounds = UPPER_BOUNDS[pollutant];
  for (let index = 0; index < bounds.length; index += 1) {
    if (value <= bounds[index]) return AQI_CATEGORIES[index];
  }
  return "Severe";
}

/** Position of a category, 0 for Good up to 5 for Severe. */
export function categoryRank(category: AqiCategory): number {
  return AQI_CATEGORIES.indexOf(category);
}

/** True when the category is at least as bad as the threshold. */
export function isAtLeast(category: AqiCategory, threshold: AqiCategory): boolean {
  return categoryRank(category) >= categoryRank(threshold);
}

/** The worse of two categories. */
export function worseCategory(a: AqiCategory, b: AqiCategory): AqiCategory {
  return categoryRank(a) >= categoryRank(b) ? a : b;
}
