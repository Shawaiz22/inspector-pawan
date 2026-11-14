import type { QualityFlag } from "../types";
import { POLLUTANT_LABELS } from "./naqi";
import { median, readingKey, type ReadingSeries } from "./readings";

/** Readings at or above this are treated as a sensor ceiling. */
export const SATURATION_VALUE = 999;
/** A reading above this multiple of the location median is a spike. */
export const SPIKE_FACTOR = 5;
/** This many equal readings in a row means a stuck sensor. */
export const STUCK_RUN = 6;
/** The location maximum repeated this often suggests a capped sensor. */
const MAX_REPEAT = 3;

function flag(
  series: ReadingSeries,
  kind: QualityFlag["kind"],
  rows: number[],
  effect: QualityFlag["effect"],
  detail: string,
): QualityFlag {
  return { kind, location: series.location, pollutant: series.pollutant, rows, effect, detail };
}

function stuckRuns(series: ReadingSeries): number[] {
  const stuck: number[] = [];
  let run: number[] = [];
  let runValue: number | null = null;
  const closeRun = () => {
    if (run.length >= STUCK_RUN) stuck.push(...run);
  };
  for (const reading of series.readings) {
    if (reading.value === null) continue;
    if (reading.value === runValue && reading.value < SATURATION_VALUE) {
      run.push(reading.row);
      continue;
    }
    closeRun();
    run = [reading.row];
    runValue = reading.value;
  }
  closeRun();
  return stuck;
}

/**
 * Checks one series for missing, negative, saturated, spike and stuck readings.
 * Negative and stuck readings are excluded from stats. Saturated readings and
 * spikes stay in, labelled with caution.
 */
export function checkSeries(series: ReadingSeries): QualityFlag[] {
  const label = `${POLLUTANT_LABELS[series.pollutant]} at ${series.location}`;
  const missing: number[] = [];
  const negative: number[] = [];
  const valid: number[] = [];
  let max = -Infinity;
  let maxCount = 0;

  for (const reading of series.readings) {
    if (reading.value === null) missing.push(reading.row);
    else if (reading.value < 0) negative.push(reading.row);
    else {
      valid.push(reading.value);
      if (reading.value > max) {
        max = reading.value;
        maxCount = 1;
      } else if (reading.value === max) maxCount += 1;
    }
  }

  const middle = median(valid);
  const capAt = maxCount >= MAX_REPEAT ? max : SATURATION_VALUE;
  const saturated: number[] = [];
  const spikes: number[] = [];
  for (const reading of series.readings) {
    if (reading.value === null || reading.value < 0) continue;
    if (reading.value >= capAt || reading.value >= SATURATION_VALUE) saturated.push(reading.row);
    else if (middle !== null && middle > 0 && reading.value > middle * SPIKE_FACTOR) spikes.push(reading.row);
  }
  const stuck = stuckRuns(series);

  const flags: QualityFlag[] = [];
  if (missing.length > 0) {
    const all = missing.length === series.readings.length;
    flags.push(flag(series, "missing", missing, "excluded", all ? `${label}: every reading is missing` : `${label}: ${missing.length} of ${series.readings.length} readings missing`));
  }
  if (negative.length > 0) flags.push(flag(series, "negative", negative, "excluded", `${label}: negative readings are impossible and were left out`));
  if (saturated.length > 0) flags.push(flag(series, "saturated", saturated, "caution", `${label}: sensor at its ceiling, true level may be higher`));
  if (spikes.length > 0) flags.push(flag(series, "spike", spikes, "caution", `${label}: readings more than ${SPIKE_FACTOR}x the location median`));
  if (stuck.length > 0) flags.push(flag(series, "stuck", stuck, "excluded", `${label}: same value ${STUCK_RUN}+ times in a row, sensor may be stuck`));
  return flags;
}

/** Runs the quality checks on every series. */
export function checkQuality(series: ReadingSeries[]): QualityFlag[] {
  return series.flatMap(checkSeries);
}

/** Keys (row:pollutant) of readings that must be left out of stats. */
export function excludedReadings(flags: QualityFlag[]): Set<string> {
  const excluded = new Set<string>();
  for (const item of flags) {
    if (item.effect !== "excluded" || item.pollutant === null) continue;
    for (const row of item.rows) excluded.add(readingKey(row, item.pollutant));
  }
  return excluded;
}
