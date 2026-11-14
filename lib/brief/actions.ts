import libraryJson from "../../data/action-library.json";
import { WARD_OFFICE } from "../roles";
import type { CaseAction, DatasetAnalysis, LibraryAction, Role } from "../types";
import { isKnownLocation, verifyCitation, type RowIndex } from "./verify";

/** The full action library. */
export const ACTION_LIBRARY: readonly LibraryAction[] = libraryJson as LibraryAction[];

const LIBRARY_BY_ID = new Map(ACTION_LIBRARY.map((action) => [action.id, action]));

/** Library actions for one role. */
export function libraryForRole(role: Role): LibraryAction[] {
  return ACTION_LIBRARY.filter((action) => action.role === role);
}

/** An action Gemini proposed, before code checks it. */
export type ProposedAction = Omit<CaseAction, "group" | "title"> & { title?: string };

/** What validation needs to know about the case. */
export interface ActionContext {
  role: Role;
  analysis: Pick<DatasetAnalysis, "locations" | "events" | "hotspots" | "avoid">;
  rowIndex: RowIndex;
  /** Nearby places the workspace owner listed. */
  places: readonly string[];
}

/** An action code refused, with the reasons. */
export interface RejectedAction {
  libraryId: string;
  reasons: string[];
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function needsReasons(entry: LibraryAction, action: ProposedAction, context: ActionContext): string[] {
  if (entry.needs === "event" && context.analysis.events.length === 0) {
    return ["This action is for citywide events, and the data has none."];
  }
  if (entry.needs === "local") {
    const location = action.target.location;
    const isHotspot = context.analysis.hotspots.some((spot) => sameText(spot.location, location));
    const hasBadWindow = context.analysis.avoid.some((item) => item.location !== null && sameText(item.location, location));
    if (!isHotspot && !hasBadWindow) return [`${location} has no local problem in the data for this action to fix.`];
  }
  return [];
}

function letterReasons(entry: LibraryAction, action: ProposedAction, places: readonly string[]): string[] {
  if (!entry.asks) return [];
  const recipient = action.letter?.to ?? "";
  if (!action.letter || !action.letter.body.trim()) return ["An \"Ask others\" action needs a drafted letter."];
  if (entry.asks === "ward_office" && !sameText(recipient, WARD_OFFICE)) {
    return [`This letter must go to the ${WARD_OFFICE.toLowerCase()}.`];
  }
  const allowed = sameText(recipient, WARD_OFFICE) || places.some((place) => sameText(place, recipient));
  return allowed ? [] : [`"${recipient}" is not the ward office or one of your listed places.`];
}

/**
 * Checks one proposed action: the library id must exist for this role, and the
 * action needs a valid daily window, a known location, and cited rows that
 * belong to that location. Letters may only go to the ward office or listed places.
 */
export function checkAction(action: ProposedAction, context: ActionContext): RejectedAction | CaseAction {
  const entry = LIBRARY_BY_ID.get(action.libraryId);
  if (!entry || entry.role !== context.role) {
    return { libraryId: action.libraryId, reasons: ["This action is not in the library for your role."] };
  }
  const reasons: string[] = [];
  const { startHour, endHour, location, pollutant } = action.target;
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < 0 || endHour > 24 || startHour >= endHour) {
    reasons.push("The action has no valid time window.");
  }
  if (!location.trim() || !isKnownLocation(location, context.analysis.locations)) {
    reasons.push(`"${location}" is not a location in the data.`);
  } else {
    reasons.push(...verifyCitation({ rows: action.rows, location, pollutant }, context.rowIndex).reasons);
    reasons.push(...needsReasons(entry, action, context));
  }
  reasons.push(...letterReasons(entry, action, context.places));
  if (reasons.length > 0) return { libraryId: action.libraryId, reasons };

  return {
    ...action,
    title: action.title?.trim() || entry.title,
    group: entry.asks ? "ask_others" : "you_can_do",
    letter: entry.asks ? action.letter : null,
  };
}

/** Splits proposed actions into accepted (deduplicated by library id and location) and rejected. */
export function validateActions(
  proposed: ProposedAction[],
  context: ActionContext,
): { accepted: CaseAction[]; rejected: RejectedAction[] } {
  const accepted: CaseAction[] = [];
  const rejected: RejectedAction[] = [];
  const seen = new Set<string>();
  for (const action of proposed) {
    const result = checkAction(action, context);
    if ("reasons" in result) {
      rejected.push(result);
      continue;
    }
    const key = `${result.libraryId}\u0000${result.target.location.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push(result);
  }
  return { accepted, rejected };
}
