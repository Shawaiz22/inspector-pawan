import { repairRequest } from "@/lib/api/schemas";
import { generateJson } from "@/lib/ai/gemini";
import { columnRepairPrompt } from "@/lib/ai/prompts";
import { columnRepairResponse, type ColumnRepairResponse } from "@/lib/ai/schemas";
import { proposeRepairs } from "@/lib/data/normalize";
import { missingRequiredFields } from "@/lib/data/parse";
import { analyzeFlagsOnly } from "@/lib/server/repair";
import { AiError } from "@/lib/server/errors";
import { handle, readJson } from "@/lib/server/http";
import { readTable } from "@/lib/server/pipeline";
import { RateLimiter } from "@/lib/server/rateLimit";
import type { ColumnMap, RepairProposal } from "@/lib/types";

export const maxDuration = 120;

const limiter = new RateLimiter(20, 60_000);

const FIELDS = ["location", "date", "time", "datetime", "pm25", "pm10", "lat", "lng"] as const;

function mergeColumns(detected: ColumnMap, ai: ColumnRepairResponse["columns"], headerCount: number): ColumnMap {
  const merged: ColumnMap = { ...detected };
  for (const field of FIELDS) {
    const index = ai[field];
    if (merged[field] === undefined && index !== null && index < headerCount) merged[field] = index;
  }
  return merged;
}

function toProposals(response: ColumnRepairResponse, rowCount: number): RepairProposal[] {
  const proposals: RepairProposal[] = [];
  response.proposals.forEach((item, index) => {
    const rows = item.rows.filter((row) => row <= rowCount);
    if (rows.length === 0) return;
    const base = { id: `ai-${index + 1}`, source: "ai" as const, rows, description: item.description, example: item.example };
    if (item.op === "scale" && item.field && item.factor) {
      proposals.push({ ...base, operation: { op: "scale", field: item.field, factor: item.factor } });
    } else if (item.op === "date_order" && item.order) {
      proposals.push({ ...base, operation: { op: "date_order", order: item.order } });
    } else if (item.op === "mark_missing" && item.field && item.token) {
      proposals.push({ ...base, operation: { op: "mark_missing", field: item.field, token: item.token } });
    }
  });
  return proposals;
}

/** Data check: code finds problems, Gemini maps headers and proposes extra fixes. */
export function POST(request: Request): Promise<Response> {
  return handle(request, limiter, async () => {
    const { text } = await readJson(request, repairRequest);
    const { table, map: detected } = readTable(text);
    const codeProposals = proposeRepairs(table, detected);

    let columns = detected;
    let aiProposals: RepairProposal[] = [];
    let notes = "";
    try {
      const response = await generateJson({
        call: "repair",
        prompt: columnRepairPrompt(table, detected, codeProposals),
        schema: columnRepairResponse,
        temperature: 0.2,
      });
      columns = mergeColumns(detected, response.columns, table.headers.length);
      aiProposals = toProposals(response, table.rows.length);
      notes = response.notes;
    } catch {
      if (missingRequiredFields(detected).length > 0) {
        throw new AiError("The column names are unclear and Gemini could not map them just now. Try again in a minute.");
      }
      notes = "Gemini was not available, so only code checks were used.";
    }

    const proposals = [...proposeRepairs(table, columns), ...aiProposals];
    return Response.json({
      headers: table.headers,
      rowCount: table.rows.length,
      columns,
      missingFields: missingRequiredFields(columns),
      proposals,
      flags: analyzeFlagsOnly(table, columns, proposals),
      notes,
    });
  });
}
