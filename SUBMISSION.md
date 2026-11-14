# SUBMISSION.md: form answers and final checklist

Edit these at the end so they match exactly what is built. The grader checks claims against code.
Remove any line about a feature that did not ship.

## Final checklist (all must be true before submitting)
- [ ] Repo is PUBLIC and opens in an incognito window
- [ ] Repo under 10 MB, no .env files, no node_modules, no .next
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass
- [ ] Vercel deploy is green and the live link opens in incognito on laptop and phone
- [ ] Live demo works end to end with week 1 then week 2 sample (real Gemini calls)
- [ ] A published notice link opens for a logged-out visitor
- [ ] No co-author lines in `git log`
- [ ] Video recorded and uploaded where the form asks

## Challenge
Civic Air Quality Briefing Studio

## Describe the changes/updates made in the deployed version
Inspector Pawan: a civic air quality investigation studio for ward officers, schools, housing
societies and other local bodies. Each upload of a messy table (paste or CSV/TSV) opens a case. A
data check finds missing values, unit mismatches, negative, spike, stuck and saturated sensors in
code, and Gemini maps messy headers and proposes fixes the user accepts or rejects, with every change
logged by row. A heat grid (location by time, colour plus number and category) shows the evidence.
Gemini writes trends and likely hotspots; every finding cites row numbers, and code verifies the rows
exist, belong to the named location and hold a reading. Unverified findings are shown with a warning.
Citywide events and local hotspots are detected in code. The case plan gives role-specific actions
from a fixed library with time window, place, numbers, rows and a follow-up check, plus drafted
letters to the ward office or places the user listed; code rejects any action without these.
Internal notes and citizen notices are generated in English and Hindi at simple and detailed levels,
with care sections for children, older adults and people with breathing problems, and can be
published as a public page with a shareable link. The next upload is compared in code with the
previous brief: improved, worsened or steady per location, new and missing locations, and hotspots
that appeared or resolved.

## Mention the Gen AI services utilized and where
Google Gemini API via @google/genai, server-side only, JSON output validated with zod, cached by
input hash, with fallback Flash models when the configured model is overloaded. 1) /api/repair: maps
messy headers and proposes data fixes. 2) /api/brief: writes trends, hotspots and role-specific case
plans from code-computed stats and flagged rows; every row citation and action is checked by code.
3) /api/advisory: internal notes and citizen notices in English and Hindi at two reading levels, with
care sections for children, older adults and sensitive people.

## Video outline (2 to 3 min), full script in PLAN.md
Hook, upload week 1, data check, evidence grid, verified findings, switch to School, Hindi notice,
publish and open the link as a citizen on phone, week 2 follow-up, closing line.
