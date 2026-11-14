import { describe, expect, it } from "vitest";
import { cleanedRowsCsv } from "@/lib/client/download";
import { loadSample } from "../support/samples";

describe("cleanedRowsCsv", () => {
  it("writes one line per row with converted values and flagged problems", () => {
    const { rows, analysis } = loadSample("week1");
    const lines = cleanedRowsCsv(rows, analysis.flags).split("\n");
    expect(lines[0]).toBe("row,location,timestamp,pm25_ug_m3,pm10_ug_m3,lat,lng,data_problems");
    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[37]).toContain("37,Govindpura Ward 41,2026-11-08T00:00,26,43");
    expect(lines[35]).toContain("saturated (PM2.5)");
  });

  it("quotes cells with commas or quotes", () => {
    const csv = cleanedRowsCsv([{ row: 1, location: 'Ward "A", North', timestamp: null, values: { pm25: null, pm10: 5 }, lat: null, lng: null }], []);
    expect(csv.split("\n")[1]).toBe('1,"Ward ""A"", North",,,5,,,');
  });
});
