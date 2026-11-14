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
societies and other local bodies. Each upload of a messy table (paste, CSV, or photo of a printed
report) opens a case. A data check finds missing values, unit mismatches, negative, stuck and
saturated sensors in code, and Gemini proposes fixes the user accepts or rejects, with every change
logged by row. A heat grid and map show the evidence. Gemini writes trends and likely hotspots; every
finding cites row numbers, code verifies the rows exist and match the location, and a second Gemini
pass audits claims. The case plan gives role-specific actions with time window, place, numbers and a
follow-up check, plus drafted letters to other bodies. Internal notes and citizen notices are
generated in English, Hindi and Urdu at simple and detailed levels, with care for children, older
adults and sensitive people and advice on when to avoid which areas, and can be published as a public page with link and QR. The next upload
is compared in code: improved, worsened, appeared, resolved, and whether past actions worked.

## Mention the Gen AI services utilized and where
Google Gemini API via @google/genai, server-side only, JSON schema output validated with zod, cached
by input hash. 1) /api/repair: maps messy headers and proposes data fixes. 2) /api/brief: writes
trends, hotspots and role-specific case plans from code-computed stats and flagged rows, with row
citations verified by code. 3) A second Gemini auditor call flags unsupported claims. 4)
/api/advisory: internal notes and citizen notices in English, Hindi and Urdu at two reading levels.
5) /api/extract: Gemini vision reads tables from photos or PDFs of printed reports.

## Video outline (2 to 3 min), full script in PLAN.md
Hook, upload week 1, data check, evidence grid, verified findings, switch to School, Hindi notice
with read aloud and QR, citizen view on phone, week 2 follow-up, closing line.
