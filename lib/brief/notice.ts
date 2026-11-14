import { hoursLabel } from "../ai/prompts";
import type { AvoidAdvice } from "../types";

/** One "when to avoid" entry as shown on a notice. Place, time, category and rows come from code only. */
export interface AvoidNoticeItem {
  place: string;
  time: string;
  category: string;
  advice: string;
  rows: number[];
}

/**
 * Joins code-computed avoid advice with Gemini's translated sentences. The
 * place, time, category and rows always come from code, so Gemini cannot
 * change them. Citywide items have an empty place; the UI labels them.
 */
export function buildAvoidNotice(avoid: AvoidAdvice[], advice: Array<{ index: number; advice: string }>): AvoidNoticeItem[] {
  const adviceByIndex = new Map(advice.map((item) => [item.index, item.advice]));
  return avoid.map((item, index) => ({
    place: item.location ?? "",
    time: item.kind === "citywide" ? `${item.start?.replace("T", " ")} to ${item.end?.replace("T", " ")}` : hoursLabel(item.startHour ?? 0, item.endHour ?? 24),
    category: item.category,
    advice: adviceByIndex.get(index) ?? "",
    rows: item.rows.slice(0, 60),
  }));
}
