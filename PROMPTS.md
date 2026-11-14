# PROMPTS.md: build steps, tools and timing

T = minutes since the challenge starts. Each step says which tool, when to start, when to stop.
Two tools run in parallel from T+50. They never edit each other's folders (see AGENTS.md).

| Step | Tool | Start | Stop |
|---|---|---|---|
| 0 Setup | You | T+0 | T+10 |
| 1 Skeleton + deploy | Claude Code | T+10 | T+20 |
| 2 Data logic + tests | Claude Code | T+20 | T+50 |
| 3 UI foundation | Antigravity | T+50 | T+90 |
| 4 AI, API, DB + tests | Claude Code | T+50 | T+90 |
| 5 UI wiring + all views | Antigravity | T+90 | T+130 |
| 6 P1 server, README, review | Claude Code | T+90 | T+130 |
| 7 Integrate, check, deploy | Claude Code | T+130 | T+145 |
| 8 Test live, submit 1, video | You | T+145 | T+165 |
| 9 Fix weakest score, final submit | Claude Code + You | T+165 | T+178 |

Claude Code: run `/model` and pick Sonnet. Run `/compact` between steps. Check `/cost` at each step.

---

## Step 0. You (T+0 to T+10)
1. `npx create-next-app@latest inspector-pawan --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm`
2. Copy into the project: AGENTS.md, CLAUDE.md, PLAN.md, DESIGN.md, PROMPTS.md, .claude/,
   .githooks/, components/BootSplash.tsx, public/samples/.
3. `git init`, `git config core.hooksPath .githooks`, create a PUBLIC GitHub repo, push.
4. Vercel: import repo, Node 20 or 22, add Neon integration (sets DATABASE_URL), add
   GEMINI_API_KEY and GEMINI_MODEL (current Flash model from AI Studio). Copy them to .env.local.

Done when: repo is public, Vercel shows a first deploy, .env.local has all three variables.

---

## Step 1. Claude Code (T+10 to T+20)
```
Read AGENTS.md and PLAN.md. Step 1 only: skeleton that deploys.
- Install: zod papaparse @types/papaparse @google/genai @neondatabase/serverless motion
  leaflet react-leaflet @types/leaflet qrcode @types/qrcode server-only; dev: vitest.
- tsconfig strict. Scripts: dev, build, start, test (vitest run), typecheck (tsc --noEmit),
  lint (eslint .).
- next.config: security headers exactly as AGENTS.md says.
- .env.example with GEMINI_API_KEY, GEMINI_MODEL, DATABASE_URL. .gitignore covers .env*,
  node_modules, .next.
- lib/server/env.ts: zod-validated server env (DB optional).
- app/api/health/route.ts: returns { ok, gemini: configured, db: configured } without secrets.
- Placeholder home page with the text "Inspector Pawan".
Run typecheck, lint, test, build. Commit "chore: scaffold project with security headers".
Push. Stop.
```
Done when: live URL `/api/health` shows `gemini: true` and `db: true`.

---

## Step 2. Claude Code (T+20 to T+50)
```
Read AGENTS.md and PLAN.md ("Data rules", "Compare rules", "Actions"). Step 2 only.
Create pure, tested modules:
- lib/types.ts: all shared types (Row, Reading, Flag, RepairProposal, LocationStats, Window,
  EventWindow, Finding, Action, Brief, CompareResult, Notice, Role).
- lib/roles.ts: presets ward_officer, school, housing_society, other; notice audience names.
- lib/data/parse.ts: CSV/TSV/pasted text, rows numbered 1..n, header detection.
- lib/data/normalize.ts: units to ug/m3, the three date formats, missing tokens to null.
- lib/data/quality.ts: missing, negative, spike, stuck, saturated, unit mismatch, each with rows.
- lib/data/stats.ts: single pass with Map: per location+pollutant count, missing, mean, max, trend,
  NAQI category, cleanest and worst 2-hour windows, hours above Poor.
- lib/data/events.ts: citywide event hours vs local hotspots.
- lib/data/fingerprint.ts: SHA-256 of normalized rows.
- lib/brief/verify.ts: rows exist AND belong to the named location.
- lib/brief/avoid.ts: avoid advice per location (worst Poor-or-worse windows) and for citywide
  event hours, each with rows. No routes.
- lib/brief/confidence.ts. lib/brief/actions.ts: validate actions against the library, require
  window + location + rows. lib/brief/compare.ts: overlap, period check, changes, action outcomes.
- data/action-library.json: 8-10 real actions per role (ward_officer, school, housing_society,
  other).
- tests/ for every module, using public/samples/ward-aq-week1.csv and week2.csv. Include: mg/m3
  ward converted, 999 flagged saturated, stuck PM10 found, negative flagged, festival hours
  detected as citywide, Govindpura as local hotspot, avoid advice for Govindpura daytime, wrong-location citation rejected, week1 vs
  week2 comparable with one new and one missing ward, non-overlapping data not compared.
One commit per module group, Conventional Commits. Run all checks. Push. Stop.
```
Done when: all tests pass, build passes, pushed.

>>> Now open Antigravity for Step 3. Keep Claude Code open for Step 4. Run both at the same time.

---

## Step 3. Antigravity (T+50 to T+90)
```
Read AGENTS.md, PLAN.md and DESIGN.md fully. You own only the UI files listed in AGENTS.md.
Do not edit lib/, app/api/, db/, data/, tests/. Write any needed server change in HANDOFF.md.
Step 3: UI foundation, following DESIGN.md exactly.
- app/globals.css: all tokens from DESIGN.md as CSS variables, light and dark.
- Fonts via next/font: Anek Latin, Anek Devanagari, Noto Nastaliq Urdu.
- Logo: a magnifying glass with a small air swirl in the lens, simple SVG (components/Logo.tsx). Use components/BootSplash.tsx in layout.
- components/: AppHeader (shows case number), StepBar (Upload, Data check, Evidence, Case plan,
  Notice, Follow-up), Panel, Button,
  Chip (row chips), Badge (AQI category with number and name), Tabs (keyboard + ARIA),
  LiveRegion, HeatGrid (location x hour, AQI colors, hatch for saturated, dotted for missing,
  fills column by column with motion, highlight prop for rows), RowsTable (highlightable),
  Drawer (mobile evidence).
- app/page.tsx: workspace setup screen (role, place name, optional nearby places list,
  "Other" role text max 150 chars) then the upload screen (paste, file, "Load sample data"
  week 1 and week 2 buttons, labeled "Sample data").
- Use types from lib/types.ts. Use the parse/stats functions from lib to render the grid locally
  right after upload (real data, no mocks).
Screenshot every screen at 360px and 1280px and fix anything that breaks DESIGN.md.
Commit with Conventional Commits, no co-author lines. Stop.
```
Done when: setup, upload and a real heat grid from the sample work in the browser.

---

## Step 4. Claude Code (T+50 to T+90, parallel with Step 3)
```
Read AGENTS.md and PLAN.md ("Gemini calls", "Data model", "API"). Step 4 only.
- lib/ai/gemini.ts (server-only client, JSON schema output, timeouts, typed errors),
  lib/ai/prompts.ts (one function per call, user text inside marked data blocks),
  lib/ai/schemas.ts (zod for every Gemini response).
- lib/server/cache.ts (bounded LRU), rateLimit.ts (bounded, evicting), token.ts (random token,
  SHA-256 hash, constant-time compare), errors.ts, db.ts (Neon, parameterized, returns null when
  DATABASE_URL is missing so callers fall back).
- db/schema.sql exactly as PLAN.md + scripts/migrate.ts + "db:migrate" script. Run it once.
- Routes with zod input validation and rate limits: /api/workspace (POST, GET, PATCH),
  /api/repair, /api/brief (repairs -> stats -> events -> Gemini brief -> auditor -> verify ->
  validate actions -> compare with previous -> store), /api/advisory, /api/notices.
  Run independent Gemini calls with Promise.all. Cache by input hash. Reuse stats by fingerprint.
- tests/api for every route with Gemini and DB mocked (tests only): validation errors, oversize
  body, rate limit, cache hit, DB missing fallback, unverified citation surfaced.
- Write the request and response shapes of every route into API.md for the UI agent.
Run all checks. Commit per route group. Push. Confirm the live /api/brief works with week 1 sample
using curl. Stop.
```
Done when: live `/api/brief` returns a verified brief for the sample.

---

## Step 5. Antigravity (T+90 to T+130)
```
Read API.md, DESIGN.md and HANDOFF.md. Step 5: wire all views to the real API. No mock data.
- Repair view: list proposals, Accept / Reject each, log of changes with rows.
- Brief view: two columns (proof left, claims right). Findings with row chips, confidence,
  verified badge or warning with reason. Focusing a claim highlights grid cells and rows.
  Event vs local labels.
- Act view: "You can do" and "Ask others" (letter with Copy button). Each action shows when,
  where, why with numbers, and the follow-up check.
- Publish view: internal note with Copy. Notice with language (English, हिंदी, اردو) and level
  (Simple, Detailed). Urdu dir="rtl" lang="ur". Read aloud with speechSynthesis (button hidden if
  unsupported). "Publish notice" -> link, Copy link, WhatsApp share, QR (next/dynamic), print.
- app/n/[slug]/page.tsx: citizen notice page per DESIGN.md, group filter chips, Listen, Print.
  Add a "When to avoid" section: place, time window, category and row chips.
- Compare view: improved, worsened, appeared, resolved, new or missing locations, action outcomes,
  "covers different areas" state with a picker for another past brief.
- Map tab (next/dynamic, react-leaflet, OSM tiles) only when rows have lat/long.
- Loading states shaped like results. Errors in the interface's voice. aria-live announcements.
- AbortController for new requests. Save workspace token in localStorage with try/catch.
Screenshot each view at 360px and 1280px, fix against DESIGN.md. Commit per view. Stop.
```
Done when: the full demo script in PLAN.md works on localhost with the sample files.

---

## Step 6. Claude Code (T+90 to T+130, parallel with Step 5)
```
Step 6. Do not edit UI files.
1. P1 server: /api/extract (image or PDF to CSV with Gemini vision, 4 MB limit, then same
   pipeline). Action outcome reporting in compare. Add tests.
2. Efficiency review of lib/ and app/api/: remove repeated passes, nested lookups, unbounded
   structures. Note each choice for the README.
3. README.md: what Inspector Pawan does, who it is for, user flows, Mermaid architecture diagram,
   requirement map table from PLAN.md with real file paths, where and why Gemini is used,
   trust design (code vs AI), security, efficiency, accessibility, privacy (raw data never
   stored), testing, env vars, how to run, future work (org accounts, public board,
   route advice once street-level data exists).
4. Read HANDOFF.md and make any server changes the UI asked for.
Run all checks. Commit. Push. Stop.
```

>>> At T+130, stop Antigravity. Go back to Claude Code for Step 7.

---

## Step 7. Claude Code (T+130 to T+145)
```
Step 7: final integration. You may now edit any file to fix bugs only, no new features.
- npm run typecheck, lint, test, build. Fix everything.
- Remove unused files, dead code, console.log, leftover TODOs. Check no secrets in git history.
- Check repo size under 10 MB.
- Run the demo script from PLAN.md against `npm run build && npm start` and fix failures.
Commit "chore: final checks". Push. Stop.
```
Done when: Vercel deploy is green.

---

## Step 8. You (T+145 to T+165)
1. Open the live link in incognito, on laptop and phone. Run the full demo script.
2. Submit (submission 1). Fill the form fields.
3. Record the video while the score is computed (script in PLAN.md).

## Step 9. Claude Code + You (T+165 to T+178)
Paste the score breakdown into Claude Code:
```
Here is the score breakdown: <paste>. Make small, safe changes that raise the lowest
parameter. No new features. Run all checks, build, commit, push.
```
Resubmit ONLY if the new deploy is green and the live demo still works end to end.
Only the last submission counts.
