-- Inspector Pawan schema. Raw uploaded data is never stored: only stats, briefs and notices.

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  role text NOT NULL,
  name text NOT NULL,
  role_note text,
  places jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  locations text[] NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL,
  brief jsonb NOT NULL,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  repairs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notices (
  slug text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brief_id uuid REFERENCES briefs(id) ON DELETE SET NULL,
  area text NOT NULL,
  content jsonb NOT NULL,
  listed boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS briefs_workspace_created_idx ON briefs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notices_listed_published_idx ON notices (listed, published_at DESC);
