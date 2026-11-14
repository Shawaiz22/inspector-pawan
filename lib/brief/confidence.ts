import type { Confidence } from "../types";

/** Fewest valid readings for high confidence. */
export const HIGH_CONFIDENCE_MIN_READINGS = 8;

/**
 * Confidence from data completeness: high when under 10% is missing and there
 * are 8+ readings, medium when under 30% is missing, otherwise low.
 */
export function confidenceFor(count: number, missing: number): Confidence {
  const total = count + missing;
  if (total === 0 || count === 0) return "low";
  const missingShare = missing / total;
  if (missingShare < 0.1 && count >= HIGH_CONFIDENCE_MIN_READINGS) return "high";
  if (missingShare < 0.3) return "medium";
  return "low";
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/** The weakest of several confidence levels; "low" for an empty list. */
export function weakestConfidence(levels: Confidence[]): Confidence {
  if (levels.length === 0) return "low";
  return levels.reduce((weakest, level) => (RANK[level] < RANK[weakest] ? level : weakest));
}
