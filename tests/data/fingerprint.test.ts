import { describe, expect, it } from "vitest";
import { fingerprintRows } from "@/lib/data/fingerprint";
import { loadSample } from "../support/samples";

describe("fingerprintRows", () => {
  it("is a stable SHA-256 of the normalized rows", async () => {
    const first = await fingerprintRows(loadSample("week1").rows);
    const second = await fingerprintRows(loadSample("week1").rows);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it("changes when any value changes", async () => {
    const { rows } = loadSample("week1");
    const before = await fingerprintRows(rows);
    const changed = rows.map((row) => (row.row === 1 ? { ...row, values: { ...row.values, pm25: 32 } } : row));
    expect(await fingerprintRows(changed)).not.toBe(before);
  });
});
