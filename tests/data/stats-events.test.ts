import { describe, expect, it } from "vitest";
import { categoryFor } from "@/lib/data/naqi";
import { windowMean } from "@/lib/data/stats";
import { loadSample } from "../support/samples";

const week1 = loadSample("week1").analysis;
const week2 = loadSample("week2").analysis;
const statsFor = (analysis: typeof week1, location: string, pollutant: "pm25" | "pm10") =>
  analysis.stats.find((entry) => entry.location === location && entry.pollutant === pollutant);

describe("NAQI categories", () => {
  it("uses CPCB 24h breakpoints for PM2.5 and PM10", () => {
    expect(categoryFor("pm25", 30)).toBe("Good");
    expect(categoryFor("pm25", 91)).toBe("Poor");
    expect(categoryFor("pm25", 251)).toBe("Severe");
    expect(categoryFor("pm10", 100)).toBe("Satisfactory");
    expect(categoryFor("pm10", 431)).toBe("Severe");
  });
});

describe("dataset shape", () => {
  it("reads locations, period and coordinates", () => {
    expect(week1.locations).toEqual(["Kolar Ward 12", "MP Nagar Ward 34", "Old City Ward 5", "Govindpura Ward 41", "Bairagarh Ward 2"]);
    expect(week1.periodStart).toBe("2026-11-08T00:00");
    expect(week1.periodEnd).toBe("2026-11-09T22:00");
    expect(week1.coordinates["Govindpura Ward 41"]).toEqual({ lat: 23.249, lng: 77.462 });
  });
});

describe("stats", () => {
  it("uses converted ug/m3 values for Govindpura", () => {
    const stats = statsFor(week1, "Govindpura Ward 41", "pm25");
    expect(stats?.count).toBe(23);
    expect(stats?.max).toEqual({ value: 311, row: 47, timestamp: "2026-11-08T20:00" });
    expect(stats?.category).toBe("Very Poor");
  });

  it("finds the worst local window outside the festival hours", () => {
    const stats = statsFor(week1, "Govindpura Ward 41", "pm25");
    expect(stats?.worst).toMatchObject({ startHour: 14, endHour: 16, category: "Very Poor" });
    expect(stats?.cleanest?.startHour).toBe(2);
  });

  it("gives low confidence when a stuck sensor removes most readings", () => {
    const stats = statsFor(week1, "Bairagarh Ward 2", "pm10");
    expect(stats?.missing).toBe(10);
    expect(stats?.confidence).toBe("low");
  });

  it("averages a daily window across days", () => {
    const stats = statsFor(week1, "Govindpura Ward 41", "pm25");
    const window = stats ? windowMean(stats, 12, 16) : null;
    expect(window?.mean).toBe(201);
    expect(window?.rows.sort((a, b) => a - b)).toEqual([43, 44, 103, 104]);
  });
});

describe("events and hotspots", () => {
  it("detects the festival nights as one citywide event", () => {
    expect(week1.events).toHaveLength(1);
    expect(week1.events[0]).toMatchObject({ start: "2026-11-08T20:00", end: "2026-11-09T02:00", category: "Severe" });
    expect(week1.events[0].rows).toContain(47);
  });

  it("finds Govindpura as the local hotspot, and nowhere else", () => {
    expect(new Set(week1.hotspots.map((spot) => spot.location))).toEqual(new Set(["Govindpura Ward 41"]));
    const pm25 = week1.hotspots.find((spot) => spot.pollutant === "pm25");
    expect(pm25?.ratio).toBeGreaterThanOrEqual(1.5);
    expect(pm25?.rows).toContain(43);
  });

  it("finds no event or hotspot in week 2", () => {
    expect(week2.events).toEqual([]);
    expect(week2.hotspots).toEqual([]);
  });
});
