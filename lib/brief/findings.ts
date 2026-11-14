import type { BriefResponse } from "../ai/schemas";
import type { Confidence, DatasetAnalysis, Finding } from "../types";
import { weakestConfidence } from "./confidence";
import { verifyCitation, type RowIndex } from "./verify";

/**
 * Confidence of a finding: the weakest confidence among the stats it is about
 * (its location and pollutant when named, otherwise every location).
 */
export function findingConfidence(
  location: string | null,
  pollutant: Finding["pollutant"],
  stats: DatasetAnalysis["stats"],
): Confidence {
  const wanted = location?.trim().toLowerCase() ?? null;
  const levels = stats
    .filter((entry) => (wanted === null || entry.location.toLowerCase() === wanted) && (pollutant === null || entry.pollutant === pollutant))
    .map((entry) => entry.confidence);
  return weakestConfidence(levels);
}

/**
 * Turns Gemini's findings into checked findings: citations verified by code,
 * and confidence computed from the data.
 * Findings that fail verification are kept and shown with their reasons.
 */
export function assembleFindings(
  response: BriefResponse,
  index: RowIndex,
  analysis: DatasetAnalysis,
): Finding[] {
  return response.findings.map((item, position) => {
    return {
      id: `f${position + 1}`,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      location: item.location,
      pollutant: item.pollutant,
      rows: item.rows,
      confidence: findingConfidence(item.location, item.pollutant, analysis.stats),
      verification: verifyCitation({ rows: item.rows, location: item.location, pollutant: item.pollutant }, index),
    };
  });
}
