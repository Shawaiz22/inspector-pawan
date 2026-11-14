import { describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import { LruCache } from "@/lib/server/cache";
import { AiError, AuthError, NotFoundError, RateLimitError, toHttpError } from "@/lib/server/errors";
import { RateLimiter } from "@/lib/server/rateLimit";
import { createSlug, createToken, hashToken, tokenMatches } from "@/lib/server/token";
import { TableParseError } from "@/lib/data/parse";

describe("LruCache", () => {
  it("evicts the least recently used entry when full", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.size).toBe(2);
  });
});

describe("RateLimiter", () => {
  it("blocks after the limit and allows again in the next window", () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.hit("ip", 0);
    limiter.hit("ip", 10);
    expect(() => limiter.hit("ip", 20)).toThrow(RateLimitError);
    expect(() => limiter.hit("ip", 1500)).not.toThrow();
  });

  it("keeps memory bounded by evicting old keys", () => {
    const limiter = new RateLimiter(5, 1000, 3);
    for (let index = 0; index < 10; index += 1) limiter.hit(`ip-${index}`, index);
    expect(limiter.size).toBe(3);
  });
});

describe("tokens", () => {
  it("creates unique tokens and compares only the stored hash", () => {
    const token = createToken();
    expect(token).not.toBe(createToken());
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(`${token}x`, hash)).toBe(false);
    expect(tokenMatches(token, "abcd")).toBe(false);
  });

  it("creates url-safe 10 character slugs", () => {
    expect(createSlug()).toMatch(/^[a-z2-9]{10}$/);
  });
});

describe("toHttpError", () => {
  const read = async (error: unknown) => {
    const response = toHttpError(error);
    return { status: response.status, body: await response.json(), headers: response.headers };
  };

  it("maps typed errors to their status without leaking internals", async () => {
    expect((await read(new AuthError())).status).toBe(401);
    expect((await read(new NotFoundError("x"))).status).toBe(404);
    expect((await read(new AiError())).status).toBe(502);
    expect((await read(new TableParseError("The table is empty."))).status).toBe(422);
    const unknown = await read(new Error("secret stack detail"));
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(unknown.body)).not.toContain("secret");
  });

  it("sets Retry-After on rate limits", async () => {
    const result = await read(new RateLimitError(12));
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("12");
  });

  it("names the invalid field for validation errors", async () => {
    const parsed = z.object({ role: z.string() }).safeParse({});
    const result = await read(parsed.error as ZodError);
    expect(result.status).toBe(400);
    expect(result.body.error.message).toContain("role");
  });
});

describe("generateJson", () => {
  it("validates with zod, caches by input hash and falls back to a second model", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "primary-model");
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 overloaded"))
      .mockResolvedValue({ text: JSON.stringify({ ok: true }) });
    vi.doMock("@google/genai", () => ({
      GoogleGenAI: class {
        models = { generateContent };
      },
      ThinkingLevel: { LOW: "LOW" },
    }));
    const { generateJson } = await import("@/lib/ai/gemini");
    const request = { call: "test", prompt: "hello", schema: z.object({ ok: z.boolean() }), temperature: 0.2 };

    expect(await generateJson(request)).toEqual({ ok: true });
    expect(generateContent.mock.calls.map((call) => call[0].model)).toEqual(["primary-model", "gemini-flash-latest"]);
    expect(await generateJson(request)).toEqual({ ok: true });
    expect(generateContent).toHaveBeenCalledTimes(2);

    generateContent.mockReset().mockResolvedValue({ text: JSON.stringify({ ok: "yes" }) });
    const { AiError: FreshAiError } = await import("@/lib/server/errors");
    await expect(generateJson({ ...request, prompt: "different" })).rejects.toBeInstanceOf(FreshAiError);
    vi.doUnmock("@google/genai");
    vi.unstubAllEnvs();
  });

  it("fails clearly when Gemini is not configured", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_API_KEY", "");
    const { generateJson } = await import("@/lib/ai/gemini");
    const { AiError: FreshAiError } = await import("@/lib/server/errors");
    await expect(generateJson({ call: "x", prompt: "p", schema: z.object({}), temperature: 0.2 })).rejects.toBeInstanceOf(FreshAiError);
    vi.unstubAllEnvs();
  });
});
