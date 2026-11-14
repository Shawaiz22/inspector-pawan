import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { briefResponse } from "./lib/ai/schemas";
import { briefPrompt } from "./lib/ai/prompts";
import { libraryForRole } from "./lib/brief/actions";
import { readFileSync } from "node:fs";
import { parseTable, detectColumns } from "./lib/data/parse";
import { proposeRepairs, normalizeTable } from "./lib/data/normalize";
import { analyzeRows } from "./lib/data/analyze";
const t = parseTable(readFileSync("public/samples/ward-aq-week1.csv", "utf8"));
const map = detectColumns(t.headers); const p = proposeRepairs(t, map);
const n = normalizeTable(t, map, p, new Set(p.map((x) => x.id)));
const analysis = analyzeRows(n.rows, ["pm25", "pm10"], n.flags);
const prompt = briefPrompt({ analysis, role: "ward_officer", roleNote: null, area: "Ward 12", places: [], library: libraryForRole("ward_officer"), changes: null });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
const js = z.toJSONSchema(briefResponse, { target: "draft-2020-12" }) as Record<string, unknown>; delete js.$schema;
const variants: Array<[string, string, Record<string, unknown>]> = [
  ["3.5 no-think", "gemini-3.5-flash", {}],
  ["3.5-lite no-think", "gemini-3.5-flash-lite", {}],
  ["3.1-lite no-think", "gemini-3.1-flash-lite", {}],
  ["latest no-think", "gemini-flash-latest", {}],
  ["3.8 minimal", "gemini-3.8-flash", { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }],
  ["3.5 low", "gemini-3.5-flash", { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }],
];
await Promise.all(variants.map(async ([label, model, extra]) => {
  const start = Date.now();
  try {
    const r = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [{ text: prompt }] }], config: { responseMimeType: "application/json", responseJsonSchema: js, temperature: 0.2, ...extra, abortSignal: AbortSignal.timeout(70000) } });
    const ok = briefResponse.safeParse(JSON.parse(r.text ?? ""));
    console.log(label, "OK", Date.now() - start, "ms valid:", ok.success, ok.success ? `${ok.data.findings.length} findings ${ok.data.actions.length} actions` : JSON.stringify(ok.error.issues[0]).slice(0, 200));
  } catch (e) { console.log(label, "ERR", Date.now() - start, "ms", String(e).slice(0, 160)); }
}));
