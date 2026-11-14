# Inspector Pawan

Every air reading investigated. Every action followed up.

Live app: https://inspector-pawan.vercel.app/

Inspector Pawan turns a messy air quality sheet into a verified case for ward officers, schools,
housing societies and other local bodies: a data check with every repair logged by row, evidence
with row citations verified by code, a case plan of local actions, citizen notices in English
and Hindi, and a follow-up that compares each new upload with the previous one.

## Run locally

```bash
cp .env.example .env.local   # fill in GEMINI_API_KEY, GEMINI_MODEL, DATABASE_URL (optional)
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
