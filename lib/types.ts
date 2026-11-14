/** Shared domain types for Inspector Pawan. Pure data, safe for client and server. */

/** Who is asking. Decides which actions and notice audience apply. */
export type Role = "ward_officer" | "school" | "housing_society" | "other";

/** Pollutants with CPCB NAQI breakpoints. */
export type Pollutant = "pm25" | "pm10";

/** CPCB NAQI category names, cleanest first. */
export type AqiCategory = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";

/** Confidence in a statistic, from missing share and reading count. */
export type Confidence = "high" | "medium" | "low";

/** A table as uploaded: header cells and data rows numbered 1..n in upload order. */
export interface RawTable {
  headers: string[];
  rows: RawRow[];
}

/** One uploaded data row. `row` is the 1-based number every citation refers to. */
export interface RawRow {
  row: number;
  cells: string[];
}

/** Semantic field a header can map to. */
export type ColumnField =
  | "location"
  | "date"
  | "time"
  | "datetime"
  | "pm25"
  | "pm10"
  | "lat"
  | "lng";

/** Header index for each recognised field. */
export type ColumnMap = Partial<Record<ColumnField, number>>;

/** A row after cleaning: canonical units (ug/m3), ISO local timestamp, missing as null. */
export interface NormalizedRow {
  row: number;
  location: string;
  /** Local time "YYYY-MM-DDTHH:mm", or null when the date could not be read. */
  timestamp: string | null;
  values: Record<Pollutant, number | null>;
  lat: number | null;
  lng: number | null;
}

/** A deterministic change code can apply to rows. Proposed by code or by Gemini. */
export type RepairOperation =
  | { op: "scale"; field: Pollutant; factor: number }
  | { op: "date_order"; order: "dmy" | "mdy" }
  | { op: "mark_missing"; field: Pollutant; token: string };

/** A proposed fix the user accepts or rejects. */
export interface RepairProposal {
  id: string;
  source: "code" | "ai";
  operation: RepairOperation;
  rows: number[];
  /** Plain description, e.g. "Convert 24 PM2.5 values from mg/m3 to ug/m3". */
  description: string;
  /** One concrete before/after example. */
  example: string;
}

/** Ledger entry: what was done to which rows. */
export interface RepairLogEntry {
  proposalId: string;
  decision: "accepted" | "rejected";
  rows: number[];
  description: string;
}

/** Kinds of data problems found by code. */
export type FlagKind =
  | "missing"
  | "negative"
  | "spike"
  | "stuck"
  | "saturated"
  | "unit_mismatch"
  | "bad_date"
  | "no_location";

/** A data problem with the rows it affects. */
export interface QualityFlag {
  kind: FlagKind;
  location: string | null;
  pollutant: Pollutant | null;
  rows: number[];
  /** "excluded" readings are left out of stats; "caution" readings are kept but labelled. */
  effect: "excluded" | "caution";
  detail: string;
}

/** Mean of one 2-hour time-of-day bucket across all days. */
export interface HourBucket {
  /** 0, 2, 4 ... 22 */
  startHour: number;
  mean: number;
  count: number;
  rows: number[];
}

/** A time-of-day window (end exclusive, may be 24) at one location. */
export interface TimeWindow {
  location: string;
  pollutant: Pollutant;
  startHour: number;
  endHour: number;
  mean: number;
  category: AqiCategory;
  rows: number[];
}

/** Statistics for one location and pollutant. */
export interface LocationStats {
  location: string;
  pollutant: Pollutant;
  /** Rows in the data for this location. */
  total: number;
  /** Valid readings used in the stats. */
  count: number;
  /** Missing or excluded readings. */
  missing: number;
  mean: number | null;
  max: { value: number; row: number; timestamp: string } | null;
  category: AqiCategory | null;
  trend: "rising" | "falling" | "steady" | "unknown";
  confidence: Confidence;
  /** Time-of-day buckets, outside citywide event hours. */
  buckets: HourBucket[];
  cleanest: TimeWindow | null;
  worst: TimeWindow | null;
  /** Readings at Poor or worse (indicative hourly category). */
  poorOrWorse: { count: number; rows: number[] };
}

/** One timestamp when 75%+ of reporting locations were Very Poor or worse. */
export interface EventSlot {
  timestamp: string;
  pollutant: Pollutant;
  affected: string[];
  reporting: number;
  rows: number[];
}

/** Consecutive event slots merged into one citywide episode. */
export interface EventWindow {
  start: string;
  /** Last slot timestamp in the episode. */
  end: string;
  pollutants: Pollutant[];
  /** Worst indicative category seen in the episode. */
  category: AqiCategory;
  rows: number[];
}

/** A location much worse than the others during bad hours outside citywide events. */
export interface LocalHotspot {
  location: string;
  pollutant: Pollutant;
  /** Share of considered hours where it was 1.5x+ the median of the others. */
  share: number;
  hoursConsidered: number;
  hoursAbove: number;
  /** Median ratio to the other locations in the hours where it stood out. */
  ratio: number;
  rows: number[];
}

/** Everything code computes from a cleaned dataset. */
export interface DatasetAnalysis {
  rowCount: number;
  locations: string[];
  timestamps: string[];
  periodStart: string | null;
  periodEnd: string | null;
  coordinates: Record<string, { lat: number; lng: number }>;
  flags: QualityFlag[];
  stats: LocationStats[];
  events: EventWindow[];
  eventSlots: EventSlot[];
  hotspots: LocalHotspot[];
}

/** Result of checking cited rows against the data. */
export interface Verification {
  verified: boolean;
  reasons: string[];
}

/** A plain-language claim about the data, with citations. */
export interface Finding {
  id: string;
  kind: "trend" | "hotspot" | "event" | "data_gap" | "window";
  title: string;
  detail: string;
  location: string | null;
  pollutant: Pollutant | null;
  rows: number[];
  confidence: Confidence;
  verification: Verification;
}

/** An entry in data/action-library.json. */
export interface LibraryAction {
  id: string;
  role: Role;
  title: string;
  needs: "local" | "event" | "any";
  lever: "schedule" | "source" | "protection" | "notice";
  effort: "low" | "medium" | "high";
  /** Set for "Ask others" actions: who the letter goes to. */
  asks?: "ward_office" | "nearby_place";
}

/** The location, daily window and pollutant an action aims to improve. */
export interface ActionTarget {
  location: string;
  startHour: number;
  endHour: number;
  pollutant: Pollutant;
}

/** A drafted letter to another body. */
export interface ActionLetter {
  to: string;
  subject: string;
  body: string;
}

/** A case-plan action filled in from the library and the computed windows. */
export interface CaseAction {
  libraryId: string;
  group: "you_can_do" | "ask_others";
  title: string;
  when: string;
  where: string;
  why: string;
  followUp: string;
  rows: number[];
  target: ActionTarget;
  letter: ActionLetter | null;
}

/** Change for one shared location and pollutant between two briefs. */
export interface StatChange {
  location: string;
  pollutant: Pollutant;
  meanBefore: number;
  meanAfter: number;
  maxBefore: number | null;
  maxAfter: number | null;
  /** Fractional change in mean, e.g. -0.25 for 25% lower. */
  change: number;
  direction: "improved" | "worsened" | "steady";
}

/** Code-computed follow-up between the previous brief and this one. */
export type CompareResult =
  | { status: "different_areas"; overlap: number; message: string }
  | {
      status: "compared";
      overlap: number;
      notNewer: boolean;
      changes: StatChange[];
      newLocations: string[];
      missingLocations: string[];
      hotspotsAppeared: string[];
      hotspotsResolved: string[];
    };

/** The snapshot of a past brief that compare needs. */
export interface BriefSnapshot {
  periodStart: string | null;
  periodEnd: string | null;
  locations: string[];
  stats: LocationStats[];
  hotspots: LocalHotspot[];
}
