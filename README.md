# Inspector Pawan

Every air reading investigated. Every action followed up.

Live app: https://inspector-pawan.vercel.app/

Inspector Pawan turns a messy air quality sheet into a verified case for ward officers, schools,
housing societies and other local bodies: a data check with every repair logged by row, evidence
with row citations verified by code, a case plan of local actions, an internal note and a citizen
notice in English and Hindi, and a follow-up that compares each new upload with the previous one.

## Flow

Setup → Upload → Data check → Evidence → Case plan → Notice → Follow-up

1. **Setup**: role (ward officer, school, housing society, other) and place name. No login: the
   workspace gets a secret token kept in the browser; only its SHA-256 hash is stored.
2. **Upload**: paste a table, upload CSV/TSV, or load the labelled sample data.
3. **Data check**: code finds missing, negative, spike, stuck and saturated readings and mg/m3
   values. Gemini maps messy headers and proposes extra fixes. The user accepts or rejects each fix;
   every decision is logged with its rows.
4. **Evidence**: heat grid (location × time, AQI colour + number + category). Gemini writes findings
   and hotspots; code checks that every cited row exists, belongs to the named location and has a
   reading. Unverified findings are shown with a warning, never hidden.
5. **Case plan**: actions chosen only from `data/action-library.json` for the role, each with a time
   window, place, numbers and rows. Code rejects anything else. "Ask others" letters go only to the
   ward office or places the user listed.
6. **Notice**: internal note plus a citizen notice in English or Hindi, simple or detailed, with care
   advice for children, older adults and people with breathing problems. Publish creates a public
   page with a shareable link.
7. **Follow-up**: the next upload is compared in code with the previous brief: improved, worsened or
   steady per location, new and missing locations, hotspots that appeared or resolved.

## Requirement map

| Requirement | Feature | Files |
|---|---|---|
| Local authorities, societies, ward teams | Role workspaces | `lib/roles.ts`, `app/api/workspace/route.ts` |
| GenAI as core | Header mapping and repair proposals, brief writer, note and notice | `lib/ai/*`, `app/api/repair`, `app/api/brief`, `app/api/advisory` |
| Pasted or uploaded tables | Paste, CSV/TSV, header detection | `lib/data/parse.ts` |
| Messy formats, units, missing readings | Repair ledger | `lib/data/normalize.ts`, `lib/data/quality.ts` |
| Trends and hotspots in plain language | Stats, citywide events vs local hotspots | `lib/data/stats.ts`, `lib/data/events.ts` |
| Prioritized actions for who is asking | Action library + validation | `data/action-library.json`, `lib/brief/actions.ts` |
| Traceable findings | Row citations verified by code | `lib/brief/verify.ts`, `lib/brief/findings.ts` |
| Gaps and unreliable readings flagged | Quality flags, confidence per finding | `lib/data/quality.ts`, `lib/brief/confidence.ts` |
| Compare with previous brief | Code compare | `lib/brief/compare.ts` |
| Internal note + citizen advisory | Advisory generation | `app/api/advisory/route.ts` |
| Multiple languages, reading levels | English and Hindi × simple and detailed | `lib/ai/prompts.ts` |
| Children, older adults, sensitive people | Care sections, group filter on the public notice | `lib/ai/schemas.ts`, `components/NoticeReader.tsx` |

## Trust design: code vs AI

Code does every number: parsing, unit conversion, quality flags, NAQI categories, windows, citywide
events (75%+ of locations Very Poor or worse at once), local hotspots, confidence and the compare.
Gemini only maps headers, proposes fixes the user approves, writes findings and actions from
code-computed stats, and writes the note and notice. Gemini output is validated with zod, and every
row citation and action is checked by code before it is shown.

Gemini (`@google/genai`, server-side only) is called in JSON mode with the expected schema in the
prompt. The configured model is tried first, then fallback Flash models, each with a time limit.
Results are cached in a bounded LRU keyed by a hash of the input.

## Security

- Secrets (`GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`) are server-only.
- Every request body is validated with zod, with size limits (200 KB text, 5000 rows, 150 chars for
  free-text role fields). Every API route is rate limited per IP with bounded memory.
- Parameterized SQL only. Workspace tokens are 32 random bytes; only the SHA-256 hash is stored and
  compared in constant time.
- Security headers (CSP, nosniff, Referrer-Policy, frame-ancestors 'none', Permissions-Policy) in
  `next.config.ts`. AI text is rendered as plain text. User text goes into prompts inside marked
  data blocks.
- Raw uploaded data is never stored. The database keeps stats, briefs and notices only.

## Efficiency

Rows are parsed once and grouped into series in one pass (`lib/data/readings.ts`); quality, stats,
events and hotspots reuse those series with `Map` lookups. Gemini gets stats and at most 12 rows per
item, never the whole table. Analysis is reused when the dataset fingerprint (SHA-256 of normalized
rows) was seen before. The workspace app loads with `next/dynamic`, and new requests abort old ones.

## Accessibility

Semantic HTML, one h1 per page, labels on every input, visible focus rings, `aria-live` announcements,
`aria-pressed` toggles, `lang="hi"` on Hindi text. AQI colour is never the only signal: cells show
the number and the category is in the label and legend. Reduced motion is respected.

## Run locally

```bash
cp .env.example .env.local   # GEMINI_API_KEY, GEMINI_MODEL, DATABASE_URL (optional)
npm install
npm run db:migrate           # once, when DATABASE_URL is set
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Without `DATABASE_URL` the app still works: the workspace and previous brief stay in the browser.

## Future work

Org accounts with admin invites, photo and PDF table extraction, a public notice board, a map view,
read-aloud, and route advice once street-level sensor data exists.
