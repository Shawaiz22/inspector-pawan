import type { Role } from "./types";

/** Display and audience settings for one workspace role. */
export interface RolePreset {
  id: Role;
  label: string;
  /** Heading for the citizen notice, e.g. "Notice for residents". */
  noticeTitle: string;
  /** Who the notice is written for. */
  noticeAudience: string;
  /** Who reads the internal note. */
  noteAudience: string;
  /** What this role can change directly. Guides "You can do" actions. */
  controls: string[];
}

/** Role presets in the order the setup screen shows them. */
export const ROLE_PRESETS: readonly RolePreset[] = [
  {
    id: "ward_officer",
    label: "Ward officer",
    noticeTitle: "Notice for residents",
    noticeAudience: "residents of the ward",
    noteAudience: "ward office staff",
    controls: ["road dust cleaning", "waste burning enforcement", "construction site checks", "public notices"],
  },
  {
    id: "school",
    label: "School",
    noticeTitle: "Notice for parents",
    noticeAudience: "parents and students",
    noteAudience: "teachers and staff",
    controls: ["outdoor activity timing", "classroom ventilation", "drop-off and pick-up", "messages to parents"],
  },
  {
    id: "housing_society",
    label: "Housing society",
    noticeTitle: "Notice for members",
    noticeAudience: "members and residents",
    noteAudience: "the society committee",
    controls: ["common area cleaning", "gate and parking rules", "garden and burning rules", "member notices"],
  },
  {
    id: "other",
    label: "Other",
    noticeTitle: "Notice for the people you serve",
    noticeAudience: "the people this place serves",
    noteAudience: "your team",
    controls: [],
  },
];

const PRESETS_BY_ID = new Map(ROLE_PRESETS.map((preset) => [preset.id, preset]));

/** Returns the preset for a role. */
export function rolePreset(role: Role): RolePreset {
  const preset = PRESETS_BY_ID.get(role);
  if (!preset) throw new Error(`Unknown role: ${role}`);
  return preset;
}

/** True when the value is a known role id. */
export function isRole(value: string): value is Role {
  return PRESETS_BY_ID.has(value as Role);
}

/** The ward office is always a valid letter recipient. */
export const WARD_OFFICE = "Ward office";

/** Max length for free-text role fields. */
export const ROLE_NOTE_MAX = 150;
