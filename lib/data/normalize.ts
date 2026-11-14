import type {
  ColumnMap,
  NormalizedRow,
  Pollutant,
  QualityFlag,
  RawTable,
  RepairLogEntry,
  RepairOperation,
  RepairProposal,
} from "../types";
import { POLLUTANT_LABELS, POLLUTANTS } from "./naqi";

/** Cell values that mean "no reading". Compared case-insensitively. */
export const MISSING_TOKENS: ReadonlySet<string> = new Set(["", "na", "n/a", "-", "null", "nan"]);

const MG_UNIT = /mg\s*\/\s*m(3|³)/i;
const NUMBER_WITH_UNIT = /^([-+]?\d+(?:[.,]\d+)?)\s*((?:mg|ug|µg|μg)\s*\/\s*m(?:3|³))?$/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A number read from a cell, with its unit if the cell carried one. */
export interface NumberCell {
  value: number | null;
  unit: "mg" | "ug" | null;
  missing: boolean;
}

/** Reads a numeric cell such as "31", "0.026 mg/m3" or "NA". Unreadable text counts as missing. */
export function readNumberCell(raw: string): NumberCell {
  const text = raw.trim();
  if (MISSING_TOKENS.has(text.toLowerCase())) return { value: null, unit: null, missing: true };
  const match = NUMBER_WITH_UNIT.exec(text);
  if (!match) return { value: null, unit: null, missing: true };
  const unit = match[2] ? (MG_UNIT.test(match[2]) ? "mg" : "ug") : null;
  return { value: Number(match[1].replace(",", ".")), unit, missing: false };
}

/** A calendar date read from a cell. `ambiguous` is set for slash dates where both parts could be the month. */
export interface DateCell {
  year: number;
  month: number;
  day: number;
  ambiguous: boolean;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthFromName(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

/**
 * Reads dd/mm/yyyy (also - or .), yyyy-mm-dd and "8 Nov 2026" / "Nov 8, 2026".
 * Slash dates are read day first; when both parts are 12 or less the result is
 * marked ambiguous so the repair ledger can confirm the order. A date whose
 * second part is above 12 can only be month first and is read that way.
 */
export function readDateCell(raw: string, order: "dmy" | "mdy" = "dmy"): DateCell | null {
  const text = raw.trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isValidDate(year, month, day) ? { year, month, day, ambiguous: false } : null;
  }
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    const ambiguous = first <= 12 && second <= 12 && first !== second;
    const monthFirst = second > 12 || (ambiguous && order === "mdy");
    const [month, day] = monthFirst ? [first, second] : [second, first];
    return isValidDate(year, month, day) ? { year, month, day, ambiguous } : null;
  }
  match = /^(\d{1,2})[\s-]+([a-z]{3,9})[\s-,]+(\d{4})$/i.exec(text);
  if (match) {
    const [day, month, year] = [Number(match[1]), monthFromName(match[2]), Number(match[3])];
    return isValidDate(year, month, day) ? { year, month, day, ambiguous: false } : null;
  }
  match = /^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  if (match) {
    const [month, day, year] = [monthFromName(match[1]), Number(match[2]), Number(match[3])];
    return isValidDate(year, month, day) ? { year, month, day, ambiguous: false } : null;
  }
  return null;
}

/** Reads "20:00", "8:30 pm", "8 PM" or a bare hour like "20". Returns null when unreadable. */
export function readTimeCell(raw: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap]\.?m\.?)?$/i.exec(raw.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase().startsWith("p") ? "pm" : match[3] ? "am" : null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const TIME_IN_TEXT = /[T\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)\s*$/i;

/** Splits a combined date-time cell into its date and time parts. */
export function splitDateTime(raw: string): { date: string; time: string } {
  const text = raw.trim();
  const match = TIME_IN_TEXT.exec(text);
  if (!match) return { date: text, time: "" };
  return { date: text.slice(0, match.index).trim(), time: match[1] };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Formats a local timestamp as "YYYY-MM-DDTHH:mm". */
export function formatTimestamp(date: DateCell, time: { hour: number; minute: number }): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(time.hour)}:${pad(time.minute)}`;
}

function dateAndTimeText(cells: string[], map: ColumnMap): { date: string; time: string } {
  if (map.datetime !== undefined) {
    const split = splitDateTime(cells[map.datetime] ?? "");
    return map.time !== undefined && !split.time ? { ...split, time: cells[map.time] ?? "" } : split;
  }
  return {
    date: map.date !== undefined ? (cells[map.date] ?? "") : "",
    time: map.time !== undefined ? (cells[map.time] ?? "") : "",
  };
}

/**
 * Proposes code-detected repairs: mg/m3 values to convert to ug/m3, and
 * ambiguous slash dates whose day/month order needs confirming. The order
 * proposed follows the unambiguous slash dates in the same file.
 */
export function proposeRepairs(table: RawTable, map: ColumnMap): RepairProposal[] {
  const proposals: RepairProposal[] = [];
  for (const field of POLLUTANTS) {
    const column = map[field];
    if (column === undefined) continue;
    const headerIsMg = MG_UNIT.test(table.headers[column] ?? "");
    const rows: number[] = [];
    let example = "";
    for (const raw of table.rows) {
      const cell = readNumberCell(raw.cells[column] ?? "");
      if (cell.value === null || cell.unit === "ug" || (cell.unit !== "mg" && !headerIsMg)) continue;
      rows.push(raw.row);
      if (!example) example = `Row ${raw.row}: ${raw.cells[column]} becomes ${round(cell.value * 1000)} ug/m3`;
    }
    if (rows.length > 0) {
      proposals.push({
        id: `code-scale-${field}`,
        source: "code",
        operation: { op: "scale", field, factor: 1000 },
        rows,
        description: `Convert ${rows.length} ${POLLUTANT_LABELS[field]} values from mg/m3 to ug/m3 (x1000)`,
        example,
      });
    }
  }

  const ambiguousRows: number[] = [];
  let ambiguousExample = "";
  let dayFirstVotes = 0;
  let monthFirstVotes = 0;
  for (const raw of table.rows) {
    const { date } = dateAndTimeText(raw.cells, map);
    const match = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{4}$/.exec(date.trim());
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12) dayFirstVotes += 1;
    else if (second > 12) monthFirstVotes += 1;
    else if (first !== second) {
      ambiguousRows.push(raw.row);
      if (!ambiguousExample) ambiguousExample = date.trim();
    }
  }
  if (ambiguousRows.length > 0) {
    const order = monthFirstVotes > dayFirstVotes ? "mdy" : "dmy";
    const read = readDateCell(ambiguousExample, order);
    proposals.push({
      id: "code-date-order",
      source: "code",
      operation: { op: "date_order", order },
      rows: ambiguousRows,
      description: `Read ${ambiguousRows.length} slash dates as ${order === "dmy" ? "day/month/year" : "month/day/year"}`,
      example: read ? `${ambiguousExample} becomes ${read.day} ${capitalize(MONTHS[read.month - 1])} ${read.year}` : ambiguousExample,
    });
  }
  return proposals;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Normalized rows plus the repair ledger and the row problems found while cleaning. */
export interface NormalizeResult {
  rows: NormalizedRow[];
  ledger: RepairLogEntry[];
  flags: QualityFlag[];
}

interface RowOperations {
  scale: Partial<Record<Pollutant, { factor: number; accepted: boolean }>>;
  dateOrder: "dmy" | "mdy" | null;
  missingTokens: Partial<Record<Pollutant, Set<string>>>;
}

function opposite(order: "dmy" | "mdy"): "dmy" | "mdy" {
  return order === "dmy" ? "mdy" : "dmy";
}

function indexOperations(
  proposals: RepairProposal[],
  accepted: ReadonlySet<string>,
  validRows: ReadonlySet<number>,
): Map<number, RowOperations> {
  const byRow = new Map<number, RowOperations>();
  for (const proposal of proposals) {
    const isAccepted = accepted.has(proposal.id);
    const operation: RepairOperation = proposal.operation;
    for (const row of proposal.rows) {
      if (!validRows.has(row)) continue;
      let ops = byRow.get(row);
      if (!ops) {
        ops = { scale: {}, dateOrder: null, missingTokens: {} };
        byRow.set(row, ops);
      }
      if (operation.op === "scale") {
        ops.scale[operation.field] = { factor: operation.factor, accepted: isAccepted };
      } else if (operation.op === "date_order") {
        ops.dateOrder = isAccepted ? operation.order : opposite(operation.order);
      } else if (isAccepted) {
        const tokens = ops.missingTokens[operation.field] ?? new Set<string>();
        tokens.add(operation.token.trim().toLowerCase());
        ops.missingTokens[operation.field] = tokens;
      }
    }
  }
  return byRow;
}

function readCoordinate(raw: string | undefined, limit: number): number | null {
  if (raw === undefined) return null;
  const value = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

/**
 * Cleans a table: reads locations, timestamps and values, applies the repairs
 * the user accepted (rejected date-order repairs use the other order; rejected
 * unit repairs leave those readings out as unit mismatches), and logs every
 * decision with its rows. Rows without a location are skipped and flagged.
 */
export function normalizeTable(
  table: RawTable,
  map: ColumnMap,
  proposals: RepairProposal[],
  accepted: ReadonlySet<string>,
): NormalizeResult {
  const validRows = new Set(table.rows.map((raw) => raw.row));
  const operations = indexOperations(proposals, accepted, validRows);
  const rows: NormalizedRow[] = [];
  const noLocation: number[] = [];
  const badDate: number[] = [];
  const unitMismatch: Record<Pollutant, number[]> = { pm25: [], pm10: [] };

  for (const raw of table.rows) {
    const location = map.location !== undefined ? (raw.cells[map.location] ?? "").replace(/\s+/g, " ").trim() : "";
    if (!location) {
      noLocation.push(raw.row);
      continue;
    }
    const ops = operations.get(raw.row);
    const text = dateAndTimeText(raw.cells, map);
    const date = readDateCell(text.date, ops?.dateOrder ?? "dmy");
    const time = text.time ? readTimeCell(text.time) : { hour: 0, minute: 0 };
    const timestamp = date && time ? formatTimestamp(date, time) : null;
    if (!timestamp) badDate.push(raw.row);

    const values: Record<Pollutant, number | null> = { pm25: null, pm10: null };
    for (const field of POLLUTANTS) {
      const column = map[field];
      if (column === undefined) continue;
      const cellText = raw.cells[column] ?? "";
      if (ops?.missingTokens[field]?.has(cellText.trim().toLowerCase())) continue;
      const cell = readNumberCell(cellText);
      if (cell.value === null) continue;
      const scale = ops?.scale[field];
      if (scale && !scale.accepted) {
        unitMismatch[field].push(raw.row);
        continue;
      }
      values[field] = scale ? round(cell.value * scale.factor) : cell.value;
    }

    rows.push({
      row: raw.row,
      location,
      timestamp,
      values,
      lat: readCoordinate(map.lat !== undefined ? raw.cells[map.lat] : undefined, 90),
      lng: readCoordinate(map.lng !== undefined ? raw.cells[map.lng] : undefined, 180),
    });
  }

  const ledger: RepairLogEntry[] = proposals.map((proposal) => ({
    proposalId: proposal.id,
    decision: accepted.has(proposal.id) ? "accepted" : "rejected",
    rows: proposal.rows.filter((row) => validRows.has(row)),
    description: proposal.description,
  }));

  const flags: QualityFlag[] = [];
  if (noLocation.length > 0) {
    flags.push({ kind: "no_location", location: null, pollutant: null, rows: noLocation, effect: "excluded", detail: `${noLocation.length} rows have no location and were left out` });
  }
  if (badDate.length > 0) {
    flags.push({ kind: "bad_date", location: null, pollutant: null, rows: badDate, effect: "excluded", detail: `${badDate.length} rows have a date or time that could not be read` });
  }
  for (const field of POLLUTANTS) {
    if (unitMismatch[field].length > 0) {
      flags.push({ kind: "unit_mismatch", location: null, pollutant: field, rows: unitMismatch[field], effect: "excluded", detail: `${unitMismatch[field].length} ${POLLUTANT_LABELS[field]} values are in mg/m3 and the conversion was rejected, so they were left out` });
    }
  }
  return { rows, ledger, flags };
}
