import type { AqiCategory, EventSlot, EventWindow, LocalHotspot, Pollutant } from "../types";
import { categoryFor, isAtLeast, worseCategory } from "./naqi";
import { median, readingKey, round1, type ReadingSeries } from "./readings";

/** Share of reporting locations that must be Very Poor or worse for a citywide event. */
export const EVENT_SHARE = 0.75;
/** A location must be this many times the others' median to stand out in an hour. */
export const HOTSPOT_RATIO = 1.5;
/** Share of considered hours a location must stand out in to be a hotspot. */
export const HOTSPOT_SHARE = 0.5;
/** Fewest considered hours before a hotspot can be called. */
export const HOTSPOT_MIN_HOURS = 3;

interface SlotValue {
  location: string;
  row: number;
  value: number;
}

/** Valid readings per pollutant and timestamp, built in one pass over the series. */
export type SlotIndex = Map<Pollutant, Map<string, SlotValue[]>>;

/** Indexes valid, non-excluded, dated readings by pollutant and timestamp. */
export function indexSlots(series: ReadingSeries[], excluded: ReadonlySet<string>): SlotIndex {
  const index: SlotIndex = new Map();
  for (const entry of series) {
    let slots = index.get(entry.pollutant);
    if (!slots) {
      slots = new Map();
      index.set(entry.pollutant, slots);
    }
    for (const reading of entry.readings) {
      if (reading.value === null || reading.timestamp === null) continue;
      if (excluded.has(readingKey(reading.row, entry.pollutant))) continue;
      const list = slots.get(reading.timestamp) ?? [];
      list.push({ location: entry.location, row: reading.row, value: reading.value });
      slots.set(reading.timestamp, list);
    }
  }
  return index;
}

/**
 * Finds hours when at least 75% of the locations reporting (two or more) were
 * Very Poor or worse at the same time: a citywide event, not a local problem.
 */
export function findEventSlots(index: SlotIndex): EventSlot[] {
  const slots: EventSlot[] = [];
  for (const [pollutant, byTime] of index) {
    for (const [timestamp, values] of byTime) {
      if (values.length < 2) continue;
      const affected = values.filter((item) => isAtLeast(categoryFor(pollutant, item.value), "Very Poor"));
      if (affected.length / values.length >= EVENT_SHARE) {
        slots.push({
          timestamp,
          pollutant,
          affected: affected.map((item) => item.location),
          reporting: values.length,
          rows: affected.map((item) => item.row),
        });
      }
    }
  }
  return slots.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
}

/**
 * Merges event slots that are next to each other in the dataset's timeline
 * into episodes, keeping every cited row and the worst category seen.
 */
export function mergeEventSlots(slots: EventSlot[], timeline: string[], index: SlotIndex): EventWindow[] {
  const position = new Map(timeline.map((timestamp, offset) => [timestamp, offset]));
  const windows: Array<EventWindow & { last: number }> = [];
  for (const slot of slots) {
    const at = position.get(slot.timestamp) ?? -1;
    const values = index.get(slot.pollutant)?.get(slot.timestamp) ?? [];
    let category: AqiCategory = "Very Poor";
    for (const item of values) category = worseCategory(category, categoryFor(slot.pollutant, item.value));

    const current = windows[windows.length - 1];
    if (current && at - current.last <= 1) {
      current.end = slot.timestamp > current.end ? slot.timestamp : current.end;
      current.last = Math.max(current.last, at);
      if (!current.pollutants.includes(slot.pollutant)) current.pollutants.push(slot.pollutant);
      current.rows.push(...slot.rows);
      current.category = worseCategory(current.category, category);
    } else {
      windows.push({ start: slot.timestamp, end: slot.timestamp, pollutants: [slot.pollutant], rows: [...slot.rows], category, last: at });
    }
  }
  return windows.map((window) => ({
    start: window.start,
    end: window.end,
    pollutants: window.pollutants,
    category: window.category,
    rows: [...new Set(window.rows)].sort((a, b) => a - b),
  }));
}

/**
 * Finds local hotspots. Hours considered are those outside citywide events in
 * which at least one location was Poor or worse, so the test asks: when the air
 * was bad, was this place much worse than everywhere else? A location is a
 * hotspot when it was 1.5x+ the median of the other locations in 50%+ of the
 * considered hours it reported (at least 3 hours).
 */
export function findHotspots(index: SlotIndex, eventTimes: ReadonlySet<string>): LocalHotspot[] {
  const hotspots: LocalHotspot[] = [];
  for (const [pollutant, byTime] of index) {
    const tally = new Map<string, { considered: number; above: number; ratios: number[]; rows: number[] }>();
    for (const [timestamp, values] of byTime) {
      if (eventTimes.has(timestamp) || values.length < 3) continue;
      if (!values.some((item) => isAtLeast(categoryFor(pollutant, item.value), "Poor"))) continue;
      const sorted = values.map((item) => item.value).sort((a, b) => a - b);
      for (const item of values) {
        const others = [...sorted];
        others.splice(others.indexOf(item.value), 1);
        const othersMedian = median(others);
        const entry = tally.get(item.location) ?? { considered: 0, above: 0, ratios: [], rows: [] };
        entry.considered += 1;
        if (othersMedian !== null && othersMedian > 0 && item.value >= othersMedian * HOTSPOT_RATIO) {
          entry.above += 1;
          entry.ratios.push(item.value / othersMedian);
          entry.rows.push(item.row);
        }
        tally.set(item.location, entry);
      }
    }
    for (const [location, entry] of tally) {
      const share = entry.considered > 0 ? entry.above / entry.considered : 0;
      if (entry.considered >= HOTSPOT_MIN_HOURS && share >= HOTSPOT_SHARE) {
        hotspots.push({
          location,
          pollutant,
          share: round1(share * 100) / 100,
          hoursConsidered: entry.considered,
          hoursAbove: entry.above,
          ratio: round1(median(entry.ratios) ?? 0),
          rows: entry.rows.sort((a, b) => a - b),
        });
      }
    }
  }
  return hotspots;
}
