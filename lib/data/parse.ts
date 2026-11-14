import Papa from "papaparse";
import type { ColumnField, ColumnMap, RawTable } from "../types";

/** Max size of pasted or uploaded text, in bytes. */
export const MAX_TEXT_BYTES = 200_000;
/** Max number of data rows. */
export const MAX_ROWS = 5000;
/** How many leading lines may hold titles before the header row. */
const HEADER_SEARCH_LINES = 10;

/** Raised when text cannot be read as a table. The message is safe to show to users. */
export class TableParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TableParseError";
  }
}

const NUMERIC_CELL = /^[-+]?\d+([.,]\d+)?(\s*(mg|ug|µg)\/m3)?$/i;

function isLabelCell(cell: string): boolean {
  const trimmed = cell.trim();
  return trimmed.length > 0 && !NUMERIC_CELL.test(trimmed);
}

/**
 * Picks the header line: the first of the leading lines whose filled cells are
 * mostly labels and that has as many filled cells as the widest leading line.
 */
function findHeaderIndex(lines: string[][]): number {
  const candidates = lines.slice(0, HEADER_SEARCH_LINES);
  let widest = 0;
  for (const line of candidates) {
    widest = Math.max(widest, line.filter((cell) => cell.trim().length > 0).length);
  }
  for (let index = 0; index < candidates.length; index += 1) {
    const filled = candidates[index].filter((cell) => cell.trim().length > 0);
    const labels = filled.filter(isLabelCell).length;
    if (filled.length >= Math.max(2, widest * 0.6) && labels >= filled.length * 0.6) return index;
  }
  return 0;
}

/**
 * Parses pasted text, CSV or TSV into a table. Detects the delimiter and the
 * header row, skips blank lines, and numbers data rows 1..n in upload order.
 * @throws TableParseError when the text is empty, too large or has no data rows.
 */
export function parseTable(text: string): RawTable {
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
    throw new TableParseError("The table is larger than 200 KB. Split it into smaller files.");
  }
  if (text.trim().length === 0) throw new TableParseError("The table is empty.");

  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", "\t", ";", "|"],
  });
  const lines = result.data.filter((line) => line.some((cell) => cell.trim().length > 0));
  const headerIndex = findHeaderIndex(lines);
  const headers = (lines[headerIndex] ?? []).map((cell) => cell.trim());
  const dataLines = lines.slice(headerIndex + 1);

  if (dataLines.length === 0) throw new TableParseError("No data rows were found under the header.");
  if (dataLines.length > MAX_ROWS) {
    throw new TableParseError(`The table has ${dataLines.length} rows. The limit is ${MAX_ROWS}.`);
  }

  return {
    headers,
    rows: dataLines.map((cells, index) => ({ row: index + 1, cells: cells.map((cell) => cell.trim()) })),
  };
}

const FIELD_PATTERNS: ReadonlyArray<[ColumnField, RegExp]> = [
  ["datetime", /(date.?time|timestamp|recorded.?at)/i],
  ["pm25", /pm\s*[-_]?\s*2[.,_]?5/i],
  ["pm10", /pm\s*[-_]?\s*10/i],
  ["lat", /^lat(itude)?\b/i],
  ["lng", /^(lon|lng|long)(gitude)?\b/i],
  ["date", /\b(date|day)\b/i],
  ["time", /\b(time|hour|hr)\b/i],
  ["location", /(station|ward|location|site|area|place|sensor|monitor|locality|zone)/i],
];

/**
 * Maps headers to fields by name. Each field takes the first matching header
 * and each header is used once. Gemini can refine this map for messy headers.
 */
export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<number>();
  for (const [field, pattern] of FIELD_PATTERNS) {
    for (let index = 0; index < headers.length; index += 1) {
      if (!used.has(index) && pattern.test(headers[index])) {
        map[field] = index;
        used.add(index);
        break;
      }
    }
  }
  return map;
}

/** Fields a table needs before it can be analysed. Returns the missing ones. */
export function missingRequiredFields(map: ColumnMap): ColumnField[] {
  const missing: ColumnField[] = [];
  if (map.location === undefined) missing.push("location");
  if (map.datetime === undefined && map.date === undefined) missing.push("date");
  if (map.pm25 === undefined && map.pm10 === undefined) missing.push("pm25");
  return missing;
}
