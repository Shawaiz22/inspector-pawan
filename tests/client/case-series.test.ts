import { describe, expect, it } from "vitest";
import { groupCasesIntoSeries } from "@/components/CaseArchiveView";
import type { CaseSummary } from "@/lib/server/db";

describe("groupCasesIntoSeries", () => {
  it("returns empty array for empty cases list", () => {
    expect(groupCasesIntoSeries([])).toEqual([]);
  });

  it("groups overlapping cases together and separates non-overlapping cases into independent series", () => {
    const cases: CaseSummary[] = [
      {
        id: "case-1",
        caseNumber: 1,
        createdAt: "2026-11-08T10:00:00.000Z",
        periodStart: "2026-11-08T10:00:00Z",
        periodEnd: "2026-11-09T10:00:00Z",
        locations: ["Kolar Ward 12", "MP Nagar Ward 34", "Old City Ward 5", "Govindpura Ward 41"],
        headline: "Air Quality Evidence Brief for Ward 11",
        summary: "",
        findingsCount: 4,
        actionsCount: 3,
        primaryHotspot: "Govindpura Ward 41",
      },
      {
        id: "case-2",
        caseNumber: 2,
        createdAt: "2026-11-12T10:00:00.000Z",
        periodStart: "2026-11-12T10:00:00Z",
        periodEnd: "2026-11-13T10:00:00Z",
        locations: ["Kolar Ward 12", "MP Nagar Ward 34", "Old City Ward 5"],
        headline: "Air Quality Briefing for Ward 11 and Surrounding Areas",
        summary: "",
        findingsCount: 4,
        actionsCount: 3,
        primaryHotspot: null,
      },
      {
        id: "case-3",
        caseNumber: 3,
        createdAt: "2026-11-14T10:00:00.000Z",
        periodStart: "2026-11-14T10:00:00Z",
        periodEnd: "2026-11-15T10:00:00Z",
        locations: ["Kolar Ward 12", "MP Nagar Ward 34", "Old City Ward 5"],
        headline: "Air Quality Evidence Brief for Ward 11 and Surrounding Areas",
        summary: "",
        findingsCount: 4,
        actionsCount: 2,
        primaryHotspot: null,
      },
      {
        id: "case-4",
        caseNumber: 4,
        createdAt: "2026-11-16T10:00:00.000Z",
        periodStart: "2026-11-10T10:00:00Z",
        periodEnd: "2026-11-11T10:00:00Z",
        locations: ["DPS Kolar Main Gate", "DPS Kolar Playground", "DPS Kolar Classroom Block"],
        headline: "Air Quality Evidence Brief for Ward 11",
        summary: "",
        findingsCount: 4,
        actionsCount: 3,
        primaryHotspot: "DPS Kolar Main Gate",
      },
    ];

    const series = groupCasesIntoSeries(cases);

    // Should create 2 distinct series
    expect(series).toHaveLength(2);

    // Most recent series is DPS Kolar (Case #4 was created Nov 16)
    const dpsSeries = series.find((s) => s.cases.some((c) => c.caseNumber === 4));
    expect(dpsSeries).toBeDefined();
    expect(dpsSeries?.cases).toHaveLength(1);
    expect(dpsSeries?.cases[0].caseNumber).toBe(4);
    expect(dpsSeries?.title).toContain("DPS Kolar");

    // Other series contains Cases #3, #2, #1 (ordered latest first)
    const wardSeries = series.find((s) => s.cases.some((c) => c.caseNumber === 1));
    expect(wardSeries).toBeDefined();
    expect(wardSeries?.cases).toHaveLength(3);
    expect(wardSeries?.cases.map((c) => c.caseNumber)).toEqual([3, 2, 1]);
  });
});
