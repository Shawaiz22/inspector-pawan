import { describe, expect, it } from "vitest";
import { confidenceFor, weakestConfidence } from "@/lib/brief/confidence";
import { buildRowIndex, verifyCitation } from "@/lib/brief/verify";
import { loadSample } from "../support/samples";

const { rows } = loadSample("week1");
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
