import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAccessCodeEmail } from "@/lib/server/email";

describe("sendAccessCodeEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("falls back to devMode when RESEND_API_KEY is not set", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = await sendAccessCodeEmail("officer@example.com", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(true);
    expect(result.devMode).toBe(true);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("PAWAN-TEST-CODE"));
  });

  it("calls Resend API when RESEND_API_KEY is configured", async () => {
    process.env.RESEND_API_KEY = "re_test_12345";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAccessCodeEmail("officer@example.com", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_12345",
        }),
      }),
    );
  });

  it("reports error when Resend API returns an error response", async () => {
    process.env.RESEND_API_KEY = "re_test_12345";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Invalid recipient",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAccessCodeEmail("invalid-email", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(false);
    expect(result.error).toContain("400");
  });

  it("disables devMode preview when DEV_ACCESS_CODE_PREVIEW is false", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.env.DEV_ACCESS_CODE_PREVIEW = "false";
    const result = await sendAccessCodeEmail("officer@example.com", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(true);
    expect(result.devMode).toBe(false);
  });

  it("disables devMode preview in production environment", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.env.NODE_ENV = "production";
    const result = await sendAccessCodeEmail("officer@example.com", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(true);
    expect(result.devMode).toBe(false);
  });
});
