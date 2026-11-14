import { describe, expect, it } from "vitest";
import { normalizeTable, proposeRepairs, readDateCell, readNumberCell, readTimeCell, splitDateTime } from "@/lib/data/normalize";
import { detectColumns, parseTable } from "@/lib/data/parse";
import { readSample } from "../support/samples";

describe("readNumberCell", () => {
  it.each(["", "NA", "n/a", "-", "null", "NaN", "offline"])("treats %j as missing", (cell) => {
    expect(readNumberCell(cell)).toEqual({ value: null, unit: null, missing: true });
  });

  it("reads units and decimal commas", () => {
    expect(readNumberCell("0.026 mg/m3")).toEqual({ value: 0.026, unit: "mg", missing: false });
    expect(readNumberCell("45 ug/m3")).toEqual({ value: 45, unit: "ug", missing: false });
    expect(readNumberCell("12,5").value).toBe(12.5);
    expect(readNumberCell("-14").value).toBe(-14);
  });
});

describe("readDateCell", () => {
  it("reads the three formats", () => {
    expect(readDateCell("2026-11-08")).toMatchObject({ year: 2026, month: 11, day: 8, ambiguous: false });
    expect(readDateCell("8 Nov 2026")).toMatchObject({ year: 2026, month: 11, day: 8 });
    expect(readDateCell("13/11/2026")).toMatchObject({ month: 11, day: 13, ambiguous: false });
  });

  it("marks day/month ambiguity and honours the chosen order", () => {
    expect(readDateCell("08/11/2026")).toMatchObject({ month: 11, day: 8, ambiguous: true });
    expect(readDateCell("08/11/2026", "mdy")).toMatchObject({ month: 8, day: 11, ambiguous: true });
  });

  it("rejects impossible dates", () => {
    expect(readDateCell("31/02/2026")).toBeNull();
    expect(readDateCell("yesterday")).toBeNull();
  });
});

describe("readTimeCell and splitDateTime", () => {
  it("reads 24h, 12h and bare hours", () => {
    expect(readTimeCell("20:00")).toEqual({ hour: 20, minute: 0 });
    expect(readTimeCell("8 PM")).toEqual({ hour: 20, minute: 0 });
    expect(readTimeCell("12:30 am")).toEqual({ hour: 0, minute: 30 });
    expect(readTimeCell("25:00")).toBeNull();
  });

  it("splits combined date-time cells", () => {
    expect(splitDateTime("2026-11-08T20:00")).toEqual({ date: "2026-11-08", time: "20:00" });
    expect(splitDateTime("8 Nov 2026 8:00 pm")).toEqual({ date: "8 Nov 2026", time: "8:00 pm" });
  });
});

describe("repairs on the week 1 sample", () => {
  const table = parseTable(readSample("week1"));
  const map = detectColumns(table.headers);
  const proposals = proposeRepairs(table, map);
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));

  it("proposes mg/m3 conversion for the Govindpura PM2.5 values", () => {
    const scale = byId.get("code-scale-pm25");
    expect(scale?.operation).toEqual({ op: "scale", field: "pm25", factor: 1000 });
    expect(scale?.rows).toHaveLength(23);
    expect(scale?.rows[0]).toBe(37);
    expect(scale?.example).toBe("Row 37: 0.026 mg/m3 becomes 26 ug/m3");
  });

  it("proposes day/month order for ambiguous slash dates", () => {
    const dates = byId.get("code-date-order");
    expect(dates?.operation).toEqual({ op: "date_order", order: "dmy" });
    expect(dates?.rows).toContain(1);
  });

  it("applies accepted repairs and logs them by row", () => {
    const result = normalizeTable(table, map, proposals, new Set(["code-scale-pm25", "code-date-order"]));
    const row37 = result.rows.find((row) => row.row === 37);
    expect(row37).toMatchObject({ location: "Govindpura Ward 41", timestamp: "2026-11-08T00:00", values: { pm25: 26, pm10: 43 } });
    expect(result.ledger.map((entry) => entry.decision)).toEqual(["accepted", "accepted"]);
    expect(result.flags).toEqual([]);
  });

  it("leaves out mg/m3 values when the conversion is rejected, and reads dates the other way", () => {
    const result = normalizeTable(table, map, proposals, new Set());
    const row37 = result.rows.find((row) => row.row === 37);
    expect(row37?.values.pm25).toBeNull();
    expect(row37?.timestamp).toBe("2026-08-11T00:00");
    const mismatch = result.flags.find((flag) => flag.kind === "unit_mismatch");
    expect(mismatch?.rows).toHaveLength(23);
    expect(result.ledger.every((entry) => entry.decision === "rejected")).toBe(true);
  });

  it("applies an accepted mark-missing repair and ignores rows that do not exist", () => {
    const custom = parseTable("Ward,Date,PM2.5\nKolar,2026-11-08,0\n,2026-11-08,40\n");
    const customMap = detectColumns(custom.headers);
    const result = normalizeTable(
      custom,
      customMap,
      [{ id: "ai-1", source: "ai", operation: { op: "mark_missing", field: "pm25", token: "0" }, rows: [1, 99], description: "Zero means offline", example: "0 becomes missing" }],
      new Set(["ai-1"]),
    );
    expect(result.rows[0].values.pm25).toBeNull();
    expect(result.ledger[0].rows).toEqual([1]);
    expect(result.flags.find((flag) => flag.kind === "no_location")?.rows).toEqual([2]);
  });
});
