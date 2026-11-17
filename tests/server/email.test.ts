import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { sendAccessCodeEmail } from "@/lib/server/email";

vi.mock("nodemailer", () => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "mock-msg-id" });
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: sendMailMock,
      }),
    },
  };
});

describe("sendAccessCodeEmail", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sends email via Nodemailer SMTP when SMTP_USER and SMTP_PASS are set", async () => {
    process.env.SMTP_USER = "sender@gmail.com";
    process.env.SMTP_PASS = "app-password-1234";

    const result = await sendAccessCodeEmail("recipient@example.com", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          user: "sender@gmail.com",
          pass: "app-password-1234",
        },
      }),
    );
  });

  it("falls back to devMode when no SMTP or Resend credentials are set", async () => {
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

  it("reports clean error message when Resend API returns an error response", async () => {
    process.env.RESEND_API_KEY = "re_test_12345";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "Invalid recipient" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAccessCodeEmail("invalid-email", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(false);
    expect(result.error).toContain("Invalid recipient");
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
    vi.stubEnv("NODE_ENV", "production");
    const result = await sendAccessCodeEmail("officer@example.com", "PAWAN-TEST-CODE");

    expect(result.sent).toBe(true);
    expect(result.devMode).toBe(false);
  });
});
