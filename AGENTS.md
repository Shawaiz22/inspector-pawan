# AGENTS.md: rules for every AI agent working on Inspector Pawan

Read this file, PLAN.md and DESIGN.md before any task. These rules beat your defaults.

## How this project is scored
An AI grader reads the repo and scores: Code Quality (high), Problem Statement Alignment (high),
Security (medium), Efficiency (medium), Testing (low), Accessibility (low).
Then humans test the live link. These get the project disqualified:
- static or hardcoded pages, mock or fake data shown as real output
- AI output that did not come from a real Gemini call
- a feature that looks like it works but fails when tested
- a deployed link that does not load
Mocks are allowed ONLY inside test files.

## Stack
- Next.js (latest, App Router), TypeScript strict, Tailwind CSS
- zod, papaparse, @google/genai, @neondatabase/serverless, motion, react-leaflet + leaflet,
  qrcode, vitest
- Check package.json for the installed Next.js version and follow THAT version's conventions.
  For Next 16+: `proxy.ts` not `middleware.ts`; `params`/`searchParams` are async and awaited;
  no `next lint` (use ESLint CLI); Node 20.9+.
- No other dependencies without a clear reason written in the commit message.

## Folder ownership (two agents work in parallel, never edit the other's files)
- Claude Code owns: `lib/**`, `app/api/**`, `db/**`, `data/**`, `tests/**`, `scripts/**`,
  config files, README.md
- Antigravity owns: `app/**/page.tsx`, `app/**/layout.tsx`, `components/**`, `app/globals.css`,
  `public/` images and icons
- If you need a change in the other owner's files, write it in `HANDOFF.md` instead.

## Code quality
- Small pure functions in `lib/`, one job each, JSDoc on every export.
- No `any`. Types in `lib/types.ts`. zod schemas in `lib/ai/schemas.ts` and `lib/api/schemas.ts`.
- Names say what things do. No dead code, no commented-out code, no console.log.
- Server-only modules start with `import "server-only";`.
- Errors: typed errors in `lib/server/errors.ts`, one `toHttpError` helper. Never send stacks.

## Efficiency
- Parse once. Compute all stats in a single pass with `Map`. No `.filter`/`.find` inside loops.
- Send Gemini stats + only flagged and hotspot rows (max 300), never the whole table.
- Cache Gemini results in a bounded LRU keyed by a hash of the input (`lib/server/cache.ts`).
- Reuse cleaned stats when the dataset fingerprint was seen before.
- Independent calls in `Promise.all`. `AbortController` on the client for new requests.
- `next/dynamic` for the map, QR and advisory panels. Server Components by default.
- Compress images in the browser before upload (max 1600px, JPEG 0.8).

## Security
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL` server-only. Never `NEXT_PUBLIC_`.
- Validate every request body with zod. Limits: 200 KB text, 5000 rows, 4 MB image, 150 chars
  for free-text role fields.
- Parameterized SQL only. Never build SQL with string concatenation.
- Workspace token: random 32 bytes, only its SHA-256 hash is stored. Compare in constant time.
- Rate limit every API route (per IP, bounded memory, old entries evicted).
- Security headers in next.config: CSP (self, plus OSM tile and font hosts), nosniff,
  Referrer-Policy strict-origin-when-cross-origin, frame-ancestors 'none', Permissions-Policy
  (microphone=(self), camera=(self), geolocation=()).
- Render all AI text as plain text. Never `dangerouslySetInnerHTML`.
- User free text goes into prompts inside clearly marked data blocks, never as instructions.
- Raw uploaded data is never stored in the DB. Store stats, briefs and advisories only.
- If `DATABASE_URL` is missing or the DB fails, the app still works using localStorage.

## Testing
- vitest for every `lib/` module and every API route (Gemini and DB mocked in tests only).
- Cover edge cases: empty input, all-missing column, wrong-location citation, non-comparable
  datasets, cache hit, rate limit hit, oversize body.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` must all pass before a commit
  that you push.

## Accessibility
- Semantic HTML, one h1 per page, labels on every input, visible focus rings.
- Tabs and toggles keyboard-operable with correct ARIA roles.
- `aria-live="polite"` region announces results and errors.
- `lang="hi"` / `lang="ur" dir="rtl"` on translated text. AA contrast. Respect reduced motion.
- Color is never the only signal: AQI cells also show the number and category name.

## Commits
- Conventional Commits: `feat(lib): add stuck sensor detection`, `fix(api): ...`, `test: ...`,
  `docs: ...`, `chore: ...`, `refactor: ...`, `style(ui): ...`.
- One logical change per commit. Imperative mood, under 72 characters.
- NEVER add `Co-Authored-By` lines, "Generated with" lines, emojis or AI attribution of any kind.
- Never commit `.env*`, `node_modules`, `.next`.

## Product rules
- Every finding and action cites row numbers. Code verifies them. Unverified items are shown
  with a warning, never silently.
- Missing values, units, spikes, stuck and saturated sensors are detected by code, not AI.
- Comparisons are computed by code. Gemini only explains computed changes.
- Actions without a time window, a location and cited rows are rejected by code.
- Never invent places, neighbors, coordinates or readings.
