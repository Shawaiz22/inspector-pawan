import { describe, expect, it } from "vitest";
import { detectColumns, MAX_ROWS, MAX_TEXT_BYTES, missingRequiredFields, parseTable, TableParseError } from "@/lib/data/parse";
import { readSample } from "../support/samples";

describe("parseTable", () => {
  it("numbers the sample rows 1..n under the header", () => {
    const table = parseTable(readSample("week1"));
    expect(table.headers[0]).toBe("Station / Ward");
    expect(table.rows).toHaveLength(120);
    expect(table.rows[0]).toMatchObject({ row: 1, cells: ["Kolar Ward 12", "08/11/2026", "00:00", "31", "45", "23.1702", "77.418", ""] });
    expect(table.rows[119].row).toBe(120);
  });

  it("skips title lines and blank lines in pasted tab-separated text", () => {
    const text = "Ward air report, November\n\nWard\tDate\tPM2.5\nKolar\t08/11/2026\t31\n\nMP Nagar\t08/11/2026\t40\n";
    const table = parseTable(text);
    expect(table.headers).toEqual(["Ward", "Date", "PM2.5"]);
    expect(table.rows.map((row) => row.row)).toEqual([1, 2]);
    expect(table.rows[1].cells[0]).toBe("MP Nagar");
  });

  it("rejects empty input", () => {
    expect(() => parseTable("   \n ")).toThrow(TableParseError);
  });

  it("rejects a header with no data rows", () => {
    expect(() => parseTable("Ward,Date,PM2.5\n")).toThrow(/No data rows/);
  });

  it("rejects text over 200 KB", () => {
    expect(() => parseTable("a".repeat(MAX_TEXT_BYTES + 1))).toThrow(/200 KB/);
  });

  it("rejects more than 5000 rows", () => {
    const text = `Ward,PM2.5\n${"Kolar,30\n".repeat(MAX_ROWS + 1)}`;
    expect(() => parseTable(text)).toThrow(/limit is 5000/);
  });
});

describe("detectColumns", () => {
  it("maps the messy sample headers", () => {
    const map = detectColumns(["Station / Ward", "Date", "Time", "PM2.5", "PM10 (ug/m3)", "Lat", "Long", "Remarks"]);
    expect(map).toEqual({ location: 0, date: 1, time: 2, pm25: 3, pm10: 4, lat: 5, lng: 6 });
    expect(missingRequiredFields(map)).toEqual([]);
  });

  it("reports what is missing when headers are unclear", () => {
    expect(missingRequiredFields(detectColumns(["col1", "col2"]))).toEqual(["location", "date", "pm25"]);
  });
});
