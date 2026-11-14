import { describe, expect, it } from "vitest";
import { compareBriefs } from "@/lib/brief/compare";
import type { CaseAction } from "@/lib/types";
import { loadSample, snapshotOf } from "../support/samples";

const week1 = loadSample("week1").analysis;
const week2 = loadSample("week2").analysis;

const peTiming: CaseAction = {
  libraryId: "sc-pe-timing",
  group: "you_can_do",
  title: "Move PE and outdoor assembly to the cleanest window of the day",
  when: "Daily",
  where: "Govindpura Ward 41",
  why: "Daytime PM2.5 is Very Poor",
  followUp: "Check 12:00 to 16:00",
  rows: [43, 44],
  target: { location: "Govindpura Ward 41", startHour: 12, endHour: 16, pollutant: "pm25" },
  letter: null,
};

describe("compareBriefs", () => {
  const result = compareBriefs(snapshotOf(week1, [peTiming]), snapshotOf(week2));
  if (result.status !== "compared") throw new Error("week 1 and week 2 should be comparable");

  it("compares week 1 with week 2: one new and one missing ward", () => {
    expect(result.overlap).toBe(0.8);
    expect(result.notNewer).toBe(false);
    expect(result.newLocations).toEqual(["Ashoka Garden Ward 18"]);
    expect(result.missingLocations).toEqual(["Bairagarh Ward 2"]);
  });

  it("shows the industrial hotspot improved and resolved", () => {
    const govindpura = result.changes.find((change) => change.location === "Govindpura Ward 41" && change.pollutant === "pm25");
    expect(govindpura?.direction).toBe("improved");
    expect(govindpura?.meanAfter).toBeLessThan(govindpura?.meanBefore ?? 0);
    expect(result.hotspotsResolved).toEqual(["Govindpura Ward 41"]);
    expect(result.hotspotsAppeared).toEqual([]);
  });

  it("reports that the stored action's target window improved", () => {
    expect(result.actionOutcomes).toHaveLength(1);
    expect(result.actionOutcomes[0]).toMatchObject({ libraryId: "sc-pe-timing", before: 201, verdict: "worked" });
    expect(result.actionOutcomes[0].after).toBeLessThan(130);
  });

  it("does not compare data that covers different areas", () => {
    const other = { ...snapshotOf(week2), locations: ["Somewhere Else", "Govindpura Ward 41"] };
    const different = compareBriefs(snapshotOf(week1), other);
    expect(different.status).toBe("different_areas");
    expect(different.overlap).toBe(0.2);
  });

  it("warns when the new data is not newer", () => {
    const again = compareBriefs(snapshotOf(week1), snapshotOf(week1));
    expect(again.status === "compared" && again.notNewer).toBe(true);
  });

  it("reports no data for an action whose location is gone", () => {
    const gone = { ...peTiming, target: { ...peTiming.target, location: "Bairagarh Ward 2" } };
    const outcome = compareBriefs(snapshotOf(week1, [gone]), snapshotOf(week2));
    expect(outcome.status === "compared" && outcome.actionOutcomes[0].verdict).toBe("no_data");
  });
});
