import "server-only";
import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const envSchema = z.object({
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.8-flash"),
  DATABASE_URL: optionalSecret,
});

/** Validated server-side configuration. Secrets never leave the server. */
export interface ServerEnv {
  geminiApiKey: string | undefined;
  geminiModel: string;
  databaseUrl: string | undefined;
}

/**
 * Reads and validates server environment variables.
 * Missing Gemini or database settings are allowed; callers decide how to degrade.
 */
export function readServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = envSchema.parse({
    GEMINI_API_KEY: source.GEMINI_API_KEY,
    GEMINI_MODEL: source.GEMINI_MODEL || undefined,
    DATABASE_URL: source.DATABASE_URL,
  });
  return {
    geminiApiKey: parsed.GEMINI_API_KEY,
    geminiModel: parsed.GEMINI_MODEL,
    databaseUrl: parsed.DATABASE_URL,
  };
}

/** Reports which integrations are configured, without exposing any values. */
export function describeConfiguration(env: ServerEnv): { gemini: boolean; db: boolean } {
  return { gemini: Boolean(env.geminiApiKey), db: Boolean(env.databaseUrl) };
}
