import type {
  AqiCategory,
  BriefSnapshot,
  CaseAction,
  ColumnMap,
  CompareResult,
  DatasetAnalysis,
  Finding,
  NormalizedRow,
  QualityFlag,
  RepairLogEntry,
  RepairProposal,
  Role,
} from "../types";
import type { PlaceCategory, PlaceEntry, StructuredPlace } from "../places";

export type { PlaceCategory, PlaceEntry, StructuredPlace };

/** Workspace profile as typed by the owner. */
export interface Profile {
  role: Role;
  name: string;
  roleNote: string | null;
  places: PlaceEntry[];
  ownerEmail?: string | null;
}

/** Response of POST /api/repair. */
export interface RepairResult {
  headers: string[];
  rowCount: number;
  columns: ColumnMap;
  missingFields: string[];
  proposals: RepairProposal[];
  flags: QualityFlag[];
  notes: string;
}

/** Response of POST /api/brief. */
export interface BriefResult {
  briefId: string | null;
  createdAt: string;
  fingerprint: string;
  headline: string;
  summary: string;
  findings: Finding[];
  actions: CaseAction[];
  rejectedActions: Array<{ libraryId: string; reasons: string[] }>;
  compare: CompareResult | null;
  analysis: DatasetAnalysis;
  rows: NormalizedRow[];
  ledger: RepairLogEntry[];
  snapshot: BriefSnapshot;
}

/** Care advice for the four notice groups. */
export interface CareText {
  children: string;
  olderAdults: string;
  sensitive: string;
  everyone: string;
}

/** Response of POST /api/advisory. */
export interface AdvisoryResult {
  language: "en" | "hi";
  level: "simple" | "detailed";
  internalNote: { title: string; body: string };
  notice: { headline: string; summary: string; care: CareText };
}

/** Notice content as published and shown on the public page. */
export interface NoticeContent {
  language: "en" | "hi";
  level: "simple" | "detailed";
  title: string;
  headline: string;
  summary: string;
  category: AqiCategory | null;
  value: number | null;
  care: CareText;
  readings: number;
  sensors: number;
}
