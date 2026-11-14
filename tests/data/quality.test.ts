import { describe, expect, it } from "vitest";
import { checkSeries, excludedReadings } from "@/lib/data/quality";
import type { ReadingSeries } from "@/lib/data/readings";
import { loadSample } from "../support/samples";

function series(values: Array<number | null>): ReadingSeries {
  return {
    location: "Test",
    pollutant: "pm25",
    readings: values.map((value, index) => ({ row: index + 1, location: "Test", timestamp: `2026-11-08T${String(index).padStart(2, "0")}:00`, value })),
  };
}

describe("quality checks on the week 1 sample", () => {
  const { analysis } = loadSample("week1");
  const find = (kind: string, location: string, pollutant: string) =>
    analysis.flags.find((flag) => flag.kind === kind && flag.location === location && flag.pollutant === pollutant);

  it("flags the 999 readings as saturated, kept with caution", () => {
    const flag = find("saturated", "Old City Ward 5", "pm25");
    expect(flag?.rows).toEqual([35, 36, 85, 86]);
    expect(flag?.effect).toBe("caution");
    expect(flag?.detail).toContain("true level may be higher");
  });

  it("finds the stuck PM10 sensor at Bairagarh and excludes it", () => {
    const flag = find("stuck", "Bairagarh Ward 2", "pm10");
    expect(flag?.rows).toEqual([52, 53, 54, 55, 56, 57, 58, 59]);
    expect(flag?.effect).toBe("excluded");
  });

  it("flags the negative reading as unreliable", () => {
    expect(find("negative", "MP Nagar Ward 34", "pm25")?.rows).toEqual([18]);
  });

  it("lists missing readings with their rows", () => {
    expect(find("missing", "Kolar Ward 12", "pm25")?.rows).toEqual([8, 62, 67, 68, 72]);
  });
});

describe("checkSeries edge cases", () => {
  it("reports an all-missing column", () => {
    const flags = checkSeries(series([null, null, null]));
    expect(flags).toHaveLength(1);
    expect(flags[0].detail).toContain("every reading is missing");
  });

  it("flags spikes above 5x the median", () => {
    const flags = checkSeries(series([20, 22, 21, 19, 200]));
    expect(flags.find((flag) => flag.kind === "spike")?.rows).toEqual([5]);
  });

  it("treats a repeated maximum as a sensor ceiling", () => {
    const flags = checkSeries(series([40, 500, 30, 500, 45, 500]));
    expect(flags.find((flag) => flag.kind === "saturated")?.rows).toEqual([2, 4, 6]);
  });

  it("does not flag clean data", () => {
    expect(checkSeries(series([30, 32, 35, 31, 40, 38]))).toEqual([]);
  });

  it("excludes only readings whose flag says so", () => {
    const excluded = excludedReadings(checkSeries(series([10, -5, null, 12])));
    expect([...excluded].sort()).toEqual(["2:pm25", "3:pm25"]);
  });
});
