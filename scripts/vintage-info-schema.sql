-- Tournament Handbook CMS tables (sibling to vintage_homepage).
-- Run once as a role that can CREATE in schema public, then GRANT to the app role.
-- Replace vintage_app_role below with your VINTAGE_DATABASE_URL username if different.

CREATE TABLE IF NOT EXISTS vintage_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version BIGINT NOT NULL DEFAULT 0,
  draft JSONB NOT NULL,
  published JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS vintage_info_revisions (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('save', 'publish', 'restore')),
  content JSONB NOT NULL
);

-- Example grants (uncomment and set the role name used by VINTAGE_DATABASE_URL):
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vintage_info TO vintage_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vintage_info_revisions TO vintage_app_role;
