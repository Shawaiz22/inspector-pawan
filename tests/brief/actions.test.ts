import { describe, expect, it } from "vitest";
import { ACTION_LIBRARY, checkAction, libraryForRole, validateActions, type ActionContext, type ProposedAction } from "@/lib/brief/actions";
import { buildRowIndex } from "@/lib/brief/verify";
import { ROLE_PRESETS, rolePreset } from "@/lib/roles";
import { loadSample } from "../support/samples";

const { rows, analysis } = loadSample("week1");
const context: ActionContext = { role: "school", analysis, rowIndex: buildRowIndex(rows), places: ["Govindpura Industrial Area"] };

function proposal(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    libraryId: "sc-pe-timing",
    when: "Daily 06:00 to 08:00",
    where: "Govindpura Ward 41",
    why: "PM2.5 averages 201 ug/m3 from 12:00 to 16:00 (rows 43, 44, 103, 104)",
    followUp: "Check the 12:00 to 16:00 average in the next upload",
    rows: [43, 44, 103, 104],
    target: { location: "Govindpura Ward 41", startHour: 12, endHour: 16, pollutant: "pm25" },
    letter: null,
    ...overrides,
  };
}

describe("action library", () => {
  it("has 8 to 10 actions per role with unique ids", () => {
    for (const preset of ROLE_PRESETS) {
      const count = libraryForRole(preset.id).length;
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThanOrEqual(10);
    }
    expect(new Set(ACTION_LIBRARY.map((action) => action.id)).size).toBe(ACTION_LIBRARY.length);
  });

  it("names the notice audience per role", () => {
    expect(rolePreset("school").noticeTitle).toBe("Notice for parents");
    expect(rolePreset("ward_officer").noticeTitle).toBe("Notice for residents");
  });
});

describe("checkAction", () => {
  it("accepts a grounded action and fills group and title from the library", () => {
    const result = checkAction(proposal(), context);
    expect(result).toMatchObject({ group: "you_can_do", title: "Move PE and outdoor assembly to the cleanest window of the day", letter: null });
  });

  it("rejects an id that is not in the library for this role", () => {
    expect(checkAction(proposal({ libraryId: "invented-action" }), context)).toHaveProperty("reasons");
    expect(checkAction(proposal({ libraryId: "wo-road-dust" }), context)).toHaveProperty("reasons");
  });

  it("rejects actions without a window, a known location or rows", () => {
    const noWindow = checkAction(proposal({ target: { location: "Govindpura Ward 41", startHour: 16, endHour: 12, pollutant: "pm25" } }), context);
    expect(noWindow).toMatchObject({ reasons: ["The action has no valid time window."] });
    const unknownPlace = checkAction(proposal({ target: { location: "Nowhere", startHour: 12, endHour: 16, pollutant: "pm25" } }), context);
    expect(unknownPlace).toMatchObject({ reasons: ['"Nowhere" is not a location in the data.'] });
    expect(checkAction(proposal({ rows: [] }), context)).toMatchObject({ reasons: ["No rows are cited."] });
  });

  it("rejects rows cited from another location", () => {
    const result = checkAction(proposal({ rows: [43, 1] }), context);
    expect(result).toMatchObject({ reasons: ["Rows 1 are not from Govindpura Ward 41."] });
  });

  it("only sends letters to the ward office for ward-office actions", () => {
    const letter = { to: "Ward office", subject: "Road dust near the school", body: "Please arrange sprinkling before 08:00." };
    expect(checkAction(proposal({ libraryId: "sc-ask-road-dust", letter }), context)).toMatchObject({ group: "ask_others" });
    const wrong = checkAction(proposal({ libraryId: "sc-ask-road-dust", letter: { ...letter, to: "Chief Minister" } }), context);
    expect(wrong).toHaveProperty("reasons");
    expect(checkAction(proposal({ libraryId: "sc-ask-road-dust" }), context)).toHaveProperty("reasons");
  });

  it("allows letters to places the user listed", () => {
    const wardContext: ActionContext = { ...context, role: "ward_officer" };
    const letter = { to: "Govindpura Industrial Area", subject: "Daytime dust", body: "Please check your controls between 10:00 and 18:00." };
    expect(checkAction(proposal({ libraryId: "wo-ask-unit-controls", letter }), wardContext)).toMatchObject({ group: "ask_others" });
    const unlisted = checkAction(proposal({ libraryId: "wo-ask-unit-controls", letter: { ...letter, to: "Some Factory" } }), wardContext);
    expect(unlisted).toHaveProperty("reasons");
  });

  it("rejects local actions where the data shows no local problem", () => {
    const result = checkAction(
      proposal({ libraryId: "sc-dropoff-idling", rows: [13], target: { location: "MP Nagar Ward 34", startHour: 0, endHour: 2, pollutant: "pm25" } }),
      context,
    );
    expect(result).toMatchObject({ reasons: ["MP Nagar Ward 34 has no local problem in the data for this action to fix."] });
  });

  it("rejects event actions when there was no citywide event", () => {
    const quiet: ActionContext = { ...context, analysis: { ...analysis, events: [] } };
    expect(checkAction(proposal({ libraryId: "sc-event-day" }), quiet)).toHaveProperty("reasons");
  });
});

describe("validateActions", () => {
  it("splits accepted and rejected, dropping duplicates", () => {
    const result = validateActions([proposal(), proposal(), proposal({ libraryId: "nope" })], context);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((item) => item.libraryId)).toEqual(["nope"]);
  });
});
