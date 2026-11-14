import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { sha256Hex } from "../data/fingerprint";
import { LruCache } from "../server/cache";
import { readServerEnv } from "../server/env";
import { AiError } from "../server/errors";

/** Per-attempt time limit. Two attempts fit inside the route's maxDuration. */
export const GEMINI_TIMEOUT_MS = 50_000;
/** Used when the configured model is overloaded or unavailable. */
const FALLBACK_MODEL = "gemini-flash-latest";

const cache = new LruCache<unknown>(200);
let client: GoogleGenAI | null = null;

function getClient(apiKey: string): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey });
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
 * Calls Gemini with JSON schema output and validates the reply with zod.
 * Results are cached by a hash of the input. Tries the configured model, then
 * a fallback model, each with a timeout.
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
  const jsonSchema = z.toJSONSchema(request.schema, { target: "draft-2020-12" });
  delete (jsonSchema as { $schema?: string }).$schema;
  const parts = [
    ...(request.files ?? []).map((file) => ({ inlineData: { data: file.data, mimeType: file.mimeType } })),
    { text: request.prompt },
  ];

  let failure = "no valid reply";
  for (const model of [...new Set([env.geminiModel, FALLBACK_MODEL])]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          temperature: request.temperature,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
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
