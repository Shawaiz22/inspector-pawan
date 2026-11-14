import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { sha256Hex } from "../data/fingerprint";
import { LruCache } from "../server/cache";
import { readServerEnv } from "../server/env";
import { AiError } from "../server/errors";

/**
 * Models tried in order, each with its own time limit, all inside the route's
 * maxDuration. The configured model goes first; the fallbacks cover overload
 * (503) and slow replies.
 */
export const FALLBACK_MODELS: ReadonlyArray<{ model: string; timeoutMs: number }> = [
  { model: "gemini-3.1-flash-lite", timeoutMs: 30_000 },
  { model: "gemini-3.5-flash", timeoutMs: 70_000 },
];
/** Time limit for the configured model. */
export const PRIMARY_TIMEOUT_MS = 15_000;

const cache = new LruCache<unknown>(200);
let client: GoogleGenAI | null = null;

function getClient(apiKey: string): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } });
  return client;
}

/** One structured Gemini request. */
export interface JsonRequest<T> {
  /** Name of the call, part of the cache key. */
  call: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature: number;
  /** Optional inline files (images, PDF) for extraction. */
  files?: Array<{ data: string; mimeType: string }>;
}

/**
 * Calls Gemini in JSON mode with the expected JSON Schema in the prompt, and
 * validates the reply with zod. Strict schema mode is not used because several
 * Flash models reject its constraints and it makes replies much slower.
 * Results are cached by a hash of the input.
 * @throws AiError when Gemini is not configured, fails, or returns invalid JSON
 */
export async function generateJson<T>(request: JsonRequest<T>): Promise<T> {
  const env = readServerEnv();
  if (!env.geminiApiKey) throw new AiError("Gemini is not configured on this server.");
  const fileKey = request.files?.map((file) => file.data).join("|") ?? "";
  const key = await sha256Hex(`${request.call}\n${env.geminiModel}\n${request.temperature}\n${request.prompt}\n${fileKey}`);
  const cached = cache.get(key);
  if (cached !== undefined) return cached as T;

  const ai = getClient(env.geminiApiKey);
  const jsonSchema = z.toJSONSchema(request.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const parts = [
    ...(request.files ?? []).map((file) => ({ inlineData: { data: file.data, mimeType: file.mimeType } })),
    { text: `${request.prompt}\nReply with JSON only, matching this JSON Schema:\n${JSON.stringify(jsonSchema)}` },
  ];
  const attempts = [{ model: env.geminiModel, timeoutMs: PRIMARY_TIMEOUT_MS }, ...FALLBACK_MODELS.filter((item) => item.model !== env.geminiModel)];

  let failure = "no valid reply";
  for (const { model, timeoutMs } of attempts) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          temperature: request.temperature,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      const parsed = request.schema.safeParse(JSON.parse(response.text ?? ""));
      if (parsed.success) {
        cache.set(key, parsed.data);
        return parsed.data;
      }
      failure = "reply did not match the expected shape";
    } catch (error) {
      // Overloaded, timed out or malformed: try the next model.
      const status = (error as { status?: number }).status;
      failure = status ? `Gemini status ${status}` : error instanceof Error ? error.name : "unknown error";
    }
  }
  throw new AiError(undefined, failure);
}
