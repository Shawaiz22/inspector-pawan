import { describe, expect, it } from "vitest";
import { decodeSessionToken, encodeSessionToken } from "@/lib/server/session";

describe("session tokens", () => {
  it("encodes and decodes user email with signature", () => {
    const token = encodeSessionToken("officer@kolar.gov.in");
    expect(token).toContain(".");
    const decoded = decodeSessionToken(token);
    expect(decoded).toEqual({ email: "officer@kolar.gov.in" });
  });

  it("rejects tampered session tokens", () => {
    const token = encodeSessionToken("officer@kolar.gov.in");
    const [payload, sig] = token.split(".");
    // Tamper payload
    const tampered = `${payload}x.${sig}`;
    expect(decodeSessionToken(tampered)).toBeNull();
  });

  it("supports authorized fallback for legacy tokens", () => {
    expect(decodeSessionToken("")).toBeNull();
    expect(decodeSessionToken(undefined)).toBeNull();
  });
});
