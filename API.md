# API

All routes accept and return JSON. Errors: `{ "error": { "code", "message" } }`. Every route is rate limited per IP (429 with `Retry-After`).
Languages are `en` and `hi`. Reading levels are `simple` and `detailed`.

## POST /api/workspace
Body `{ role, name, roleNote?, places? }` (role: `ward_officer | school | housing_society | other`, roleNote max 150, places max 10).
Returns `201 { id, token }`. Keep the token in the browser; only its hash is stored. 503 when there is no database: keep the workspace in localStorage.

## GET /api/workspace?id=  and  PATCH /api/workspace?id=
Header `x-workspace-token`. GET returns `{ id, role, name, roleNote, places }`. PATCH takes any of the POST fields.

## POST /api/repair
Body `{ text }` (max 200 KB, 5000 rows). Returns `{ headers, rowCount, columns, missingFields, proposals, flags, notes }`.
`proposals` are `{ id, source: "code" | "ai", operation, rows, description, example }`. Show Accept / Reject for each.

## POST /api/brief
Body `{ text, columns?, proposals, accepted: string[], workspace, workspaceId?, previousBriefId?, previous? }`.
Send `x-workspace-token` with `workspaceId` to store the brief and compare with the latest stored one. Without a database, send `previous` (the `snapshot` of the last result, kept in localStorage).
Returns `{ briefId, createdAt, fingerprint, headline, summary, findings, actions, rejectedActions, compare, analysis, rows, ledger, snapshot }`.
- `findings[]`: `{ id, kind, title, detail, location, pollutant, rows, confidence, verification: { verified, reasons } }`. Show a warning with `reasons` when `verified` is false.
- `actions[]`: `{ libraryId, group: "you_can_do" | "ask_others", title, when, where, why, followUp, rows, target, letter }`.
- `compare`: `null`, `{ status: "different_areas", message }` or `{ status: "compared", changes, newLocations, missingLocations, hotspotsAppeared, hotspotsResolved, notNewer }`.
- `analysis`: `flags, stats, events, hotspots, coordinates, timestamps, periodStart, periodEnd, locations` for the heat grid. `rows` are the cleaned rows for highlighting.

## POST /api/advisory
Body `{ language, level, role, area, headline, summary, findings, actions }`.
Returns `{ language, level, internalNote: { title, body }, notice: { headline, summary, care } }` with `care` = `{ children, olderAdults, sensitive, everyone }`.

## POST /api/notices
Header `x-workspace-token`. Body `{ workspaceId, briefId, area, content }` (content as in `noticeContent` in `lib/api/schemas.ts`). Returns `201 { slug, path, publishedAt }`.

## GET /api/notices?slug=
Public. Returns `{ slug, area, content, publishedAt }`, 404 when unknown.
