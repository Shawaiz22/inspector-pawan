# PLAN.md: Inspector Pawan, Civic Air Quality Briefing Studio

## Problem statement (verbatim)
Develop an AI-driven civic intelligence solution that enables local authorities, housing societies,
and ward-level teams to turn raw air quality data into actionable local interventions. The solution
must leverage Generative AI as a core component to interpret pasted or uploaded data tables,
including messy ones with inconsistent formats, units, or missing readings, and summarize trends and
likely hotspots in plain language. It should recommend prioritized local actions suited to who is
asking, since a ward officer, a housing society, and a school can each do different things. Every
finding should be traceable to the underlying data, with data gaps and unreliable readings clearly
flagged. The assistant should compare each new brief with the previous one to show what changed,
and generate both an internal briefing note and a citizen advisory in multiple languages, written for
different reading levels, with extra care for children, older adults, and people sensitive to poor air.

## Name and idea
Inspector Pawan. Pawan means air, and it is also a common Indian name, so the app reads like a
detective character. Tagline: "Every air reading investigated. Every action followed up."

Inspector Pawan turns a messy air quality sheet into a verified case: evidence (findings with rows),
a case plan (concrete local actions for who is asking), a public notice people can actually read,
and a follow-up on the next upload that checks whether the actions worked.

## Case language (use everywhere in UI, README and video)
- Each upload opens a case: "Case #3, Ward 12, 8 to 9 Nov".
- Data problems found and fixed: "Data check".
- Findings: "Evidence", each with row chips.
- Actions: "Case plan", split into "You can do" and "Ask others".
- Compare: "Follow-up".
- Persona voice is only for headings and status lines ("Inspector Pawan found 3 data problems",
  "Follow-up: the PE timing worked"). Findings, actions, notes and notices stay plain and serious.
  The persona never jokes about health.

## Who uses it
| Person | Sets up | Gets |
|---|---|---|
| Ward officer | Workspace: role, ward name, optional nearby places | Actions, letters to other bodies, internal note, notice for residents |
| School principal | Same, role School | Actions, letter to ward office, internal note for staff, notice for parents |
| Housing society | Same, role Housing society | Actions, letter to ward office, committee note, notice for members |
| Other (hospital, market, site) | Role typed (max 150 chars) + ticks what they control | Same outputs, tailored |
| Citizen | Nothing | Opens a published notice by link or QR. Picks language and who they worry about. Reads or listens |

No login. Each workspace gets a secret token saved in the browser. Nearby places are typed by the
workspace owner and used only to address letters. The ward office is always a valid recipient.

## Flow
Setup -> Upload -> Data check -> Evidence -> Case plan -> Notice -> Follow-up
(Code names: upload, repair, brief, actions, publish, compare.)

1. Upload: paste text, upload CSV/TSV, or upload a photo/PDF of a printed table (Gemini vision
   extracts it to CSV, then it goes through the same pipeline).
2. Repair: code finds problems. Gemini maps messy headers and proposes fixes (unit conversion, date
   reading). User accepts or rejects each. Every change is logged with its row number.
3. Brief: heat grid (location x hour) and map (only if lat/long exist). Findings and hotspots with
   cited rows, confidence level, verified or unverified badge.
4. Act: actions for this role in two groups: "You can do" and "Ask others" (drafted letters).
5. Publish: internal note (copy). Notice for the people this role serves, in English, Hindi, Urdu,
   simple or detailed. Publish creates a public page with link, WhatsApp share, QR and print view.
6. Compare: next upload is compared with the previous brief of the same workspace. Shows improved,
   worsened, appeared, resolved, and whether last time's actions worked.

## Feature priority
- P0: setup, upload (text/CSV), repair ledger, heat grid, verified findings, role actions with "ask
  others" letters, internal note, advisory (3 languages x 2 levels), code-based compare, Neon storage
  with localStorage fallback, public notice page with link + QR.
- P1: photo/PDF table extraction, map, read-aloud, confidence per finding, action outcome check,
  event vs local detection shown in UI, boot splash,
  avoid-area advice on the notice (worst windows per location, citywide event hours, with rows).
- P2: voice questions about the brief, public notice board listing.
Cut P2 first, then P1 from the bottom. Never cut verification or compare.

## Requirement map (copy into README, with real file paths)
| Requirement | Feature | Files |
|---|---|---|
| Local authorities, societies, ward teams | Role workspaces | lib/roles.ts, app/api/workspace |
| GenAI as core | Header mapping, repair proposals, brief, audit, advisory, image extraction | lib/ai/* |
| Pasted or uploaded tables | Paste, CSV, photo/PDF | lib/data/parse.ts, app/api/extract |
| Messy formats, units, missing readings | Repair ledger | lib/data/normalize.ts, lib/data/quality.ts |
| Trends and hotspots in plain language | Stats + brief | lib/data/stats.ts, lib/data/events.ts |
| Prioritized actions for who is asking | Action library + validation | data/action-library.json, lib/brief/actions.ts |
| Traceable findings | Row citations + verification + audit | lib/brief/verify.ts |
| Gaps and unreliable readings flagged | Quality panel, confidence | lib/data/quality.ts, lib/brief/confidence.ts |
| Compare with previous brief | Code compare + action outcomes | lib/brief/compare.ts |
| Internal note + citizen advisory | Advisory generation | app/api/advisory |
| Multiple languages, reading levels | en/hi/ur x simple/detailed | lib/ai/prompts.ts |
| Children, older adults, sensitive people | Care sections, citizen filter | lib/ai/schemas.ts, app/n/[slug] |
| Extra care for sensitive people | Avoid-area advice (when and where to limit time outdoors) | lib/brief/avoid.ts, app/n/[slug] |

## Data rules (code, not AI)
- Rows numbered 1..n in upload order. Every derived value keeps its source row numbers.
- Missing: "", NA, N/A, -, null, nan.
- Units: values or headers with mg/m3 are multiplied by 1000 to ug/m3.
- Dates: dd/mm/yyyy, yyyy-mm-dd, "8 Nov 2026". Ambiguous dates go to the repair ledger.
- Negative value: unreliable. Spike: > 5x the location median. Stuck: same value 6+ times in a row
  for one location and pollutant. Saturated: value >= 999 or the location's max repeated 3+ times,
  label "true level may be higher".
- NAQI sub-index (CPCB) PM2.5 24h breakpoints: 0-30 Good, 31-60 Satisfactory, 61-90 Moderate,
  91-120 Poor, 121-250 Very Poor, 251+ Severe. PM10: 0-50, 51-100, 101-250, 251-350, 351-430, 431+.
  Show category names, not just colors. Hourly values are labeled "indicative" since NAQI uses 24h.
- Event vs local: an hour is a citywide event when 75%+ of locations are Very Poor or worse at once.
  A location is a local hotspot when its mean is 1.5x+ the median of other locations in 50%+ of hours.
- Windows: per location, cleanest and worst 2-hour windows, hours above Poor.
- Confidence: high if missing < 10% and 8+ readings, medium if missing < 30%, else low.
- Fingerprint: SHA-256 of the normalized rows. Same fingerprint reuses stats.
- Avoid advice: built only from worst windows (Poor or worse) per location and citywide event hours,
  each with its rows. Never suggest routes: there is no data between sensor points.

## Compare rules (code)
- Only the same workspace. Previous = latest brief before this one.
- Overlap = shared locations / locations in previous. Below 50%: no compare, show "covers different
  areas, new series started" and let the user pick another past brief.
- New period not later than previous: warn "not newer than your last brief".
- Per shared location and pollutant: change in mean and max. Within 10% = steady.
- Locations only in new data: "new in this data". Only in old: "not in this data".
- Action outcome: each stored action has a target {location, window, pollutant}. Recompute that
  window in the new data and report the change.

## Actions
- data/action-library.json: 8-10 actions per role. Each: id, role, title, needs ("local" | "event" |
  "any"), lever (schedule | source | protection | notice), effort (low | medium | high).
- Gemini picks from the library and fills: when (from computed windows), where (location), why (numbers
  + rows), follow-up check. It may adapt wording, not invent new action types.
- Code rejects any action without window, location and rows, or whose library id does not exist.
- "Ask others" letters go only to the ward office or places the user listed.

## Gemini calls (all server-side, JSON schema output, zod-validated, cached)
1. map-columns + repair proposals (headers + first 8 rows + code flags)
2. brief writer (stats, windows, event/local, flagged rows, role, action library, places)
3. auditor (claims + stats only): flags overstated or unsupported claims
4. advisory (brief + language + level), with care sections. Includes the code-computed avoid advice,
   translated, without changing places, times or rows
5. extract table from image/PDF (P1)
6. ask (P2): answers questions from stats with cited rows
Model from GEMINI_MODEL. Temperature 0.2 for 1-3 and 5, 0.4 for 4.

## Data model (Neon, db/schema.sql)
- workspaces(id uuid pk, token_hash text, role text, name text, role_note text, places jsonb,
  created_at timestamptz)
- briefs(id uuid pk, workspace_id uuid fk, fingerprint text, period_start timestamptz,
  period_end timestamptz, locations text[], stats jsonb, brief jsonb, actions jsonb, repairs jsonb,
  created_at timestamptz)
- notices(slug text pk (random 10 chars), workspace_id uuid fk, brief_id uuid fk, area text,
  content jsonb, listed boolean default false, published_at timestamptz)
Indexes: briefs(workspace_id, created_at desc), notices(listed, published_at desc).

## API
- POST /api/workspace -> {id, token}. GET/PATCH with header x-workspace-token.
- POST /api/repair -> flags, column map, repair proposals.
- POST /api/brief -> applies accepted repairs, stats, Gemini brief + audit, verify, actions, compare,
  stores brief.
- POST /api/advisory -> internal note + notice for language and level.
- POST /api/notices -> publish (token required). GET /n/[slug] public page.
- POST /api/extract (P1). POST /api/ask (P2). GET /board (P2).

## Future work (README)
- Org accounts with admin invites. Public notice board listing. Route advice once street-level
  sensor data exists.

## Samples (test input only, labeled in UI as "Sample data")
- public/samples/ward-aq-week1.csv: 5 Bhopal wards, festival night spike, mg/m3 ward, saturated 999
  readings, NA/blanks, one negative, one stuck PM10 sensor, industrial local hotspot.
- public/samples/ward-aq-week2.csv: 4 shared wards + 1 new ward, industrial hotspot improved.

## Demo video (2-3 min)
1. 0:00 Hook: after the festival nights, people saw very different air numbers for the same city.
   Even the numbers are messy. (Verify any real figure and source before saying it.)
2. 0:15 Ward officer uploads week 1. Repair ledger: mg/m3 fixed, 999 flagged as saturated.
3. 0:45 Heat grid fills. Click Govindpura cell, rows highlight. Festival spike marked citywide.
4. 1:10 Findings with rows and confidence. One unverified claim shown with its warning.
5. 1:30 Switch to School: different actions, letter to ward office.
6. 1:50 Hindi notice, simple level, read aloud. Publish, QR, open as citizen on phone.
7. 2:20 Upload week 2: improved, new ward, action outcome "worked".
8. 2:40 Close: "Meet Inspector Pawan. Every air reading investigated. Every action followed up."

## Submission plan
- Submission 1 at about 2:00 into the build with P0 live, to see the score breakdown.
- Fix the weakest parameter, then final submission only if the new build is deployed and tested.
- Only the last submission counts, so never submit an untested build.
