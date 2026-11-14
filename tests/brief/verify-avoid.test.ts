import { describe, expect, it } from "vitest";
import { confidenceFor, weakestConfidence } from "@/lib/brief/confidence";
import { buildRowIndex, verifyCitation } from "@/lib/brief/verify";
import { loadSample } from "../support/samples";

const { rows, analysis } = loadSample("week1");
const index = buildRowIndex(rows);

describe("verifyCitation", () => {
  it("accepts rows from the named location", () => {
    expect(verifyCitation({ rows: [43, 44], location: "Govindpura Ward 41", pollutant: "pm25" }, index)).toEqual({ verified: true, reasons: [] });
  });

  it("rejects a citation whose rows belong to another location", () => {
    const result = verifyCitation({ rows: [43, 7], location: "Govindpura Ward 41", pollutant: null }, index);
    expect(result.verified).toBe(false);
    expect(result.reasons).toEqual(["Rows 7 are not from Govindpura Ward 41."]);
  });

  it("rejects rows that do not exist, empty citations and missing readings", () => {
    expect(verifyCitation({ rows: [999], location: null, pollutant: null }, index).reasons[0]).toContain("do not exist");
    expect(verifyCitation({ rows: [], location: null, pollutant: null }, index).verified).toBe(false);
    expect(verifyCitation({ rows: [8], location: "Kolar Ward 12", pollutant: "pm25" }, index).reasons[0]).toContain("no reading");
  });
});

describe("avoid advice", () => {
  it("tells people when to limit time near Govindpura in the daytime", () => {
    const govindpura = analysis.avoid.find((item) => item.location === "Govindpura Ward 41");
    expect(govindpura).toMatchObject({ kind: "local", startHour: 10, endHour: 18, category: "Very Poor" });
    expect(govindpura?.rows).toContain(43);
  });

  it("includes the citywide festival hours with their rows", () => {
    const citywide = analysis.avoid.filter((item) => item.kind === "citywide");
    expect(citywide).toHaveLength(1);
    expect(citywide[0]).toMatchObject({ location: null, start: "2026-11-08T20:00", end: "2026-11-09T02:00" });
    expect(citywide[0].rows.length).toBeGreaterThan(0);
  });

  it("only uses windows that are Poor or worse", () => {
    expect(analysis.avoid.every((item) => ["Poor", "Very Poor", "Severe"].includes(item.category))).toBe(true);
    expect(analysis.avoid.some((item) => item.location === "MP Nagar Ward 34")).toBe(false);
  });
});

describe("confidence", () => {
  it("follows the missing-share and reading-count rules", () => {
    expect(confidenceFor(9, 0)).toBe("high");
    expect(confidenceFor(7, 0)).toBe("medium");
    expect(confidenceFor(8, 2)).toBe("medium");
    expect(confidenceFor(5, 5)).toBe("low");
    expect(confidenceFor(0, 0)).toBe("low");
    expect(weakestConfidence(["high", "low", "medium"])).toBe("low");
  });
});
