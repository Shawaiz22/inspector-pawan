import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

function generateAccessCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(8);
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) p1 += chars[bytes[i] % chars.length];
  for (let i = 4; i < 8; i++) p2 += chars[bytes[i] % chars.length];
  return `PAWAN-${p1}-${p2}`;
}

describe("generateAccessCode", () => {
  it("generates valid 2-part alphanumeric code without undefined", () => {
    for (let j = 0; j < 20; j++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^PAWAN-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
      expect(code).not.toContain("undefined");
    }
  });
});
