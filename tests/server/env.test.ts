import { describe, expect, it } from "vitest";
import { describeConfiguration, readServerEnv } from "@/lib/server/env";

describe("readServerEnv", () => {
  it("treats blank secrets as missing and defaults the model", () => {
    const env = readServerEnv({ GEMINI_API_KEY: "  ", DATABASE_URL: "" });
    expect(env).toEqual({ geminiApiKey: undefined, geminiModel: "gemini-3.8-flash", databaseUrl: undefined });
    expect(describeConfiguration(env)).toEqual({ gemini: false, db: false });
  });

  it("reports configured integrations as booleans only", () => {
    const env = readServerEnv({
      GEMINI_API_KEY: "key",
      GEMINI_MODEL: "model-x",
      DATABASE_URL: "postgres://x",
    });
    expect(env.geminiModel).toBe("model-x");
    expect(describeConfiguration(env)).toEqual({ gemini: true, db: true });
  });
});
