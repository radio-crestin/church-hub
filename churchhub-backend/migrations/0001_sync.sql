-- Cloud sync central state (T-171, docs/design/cloud-sync-and-shared-library.md §4).
-- Applied by `wrangler d1 migrations apply SYNC_DB` on Cloudflare and by
-- src/selfhost/applyMigrations.ts on a self-hosted SQLite file.

CREATE TABLE churches (
  id TEXT PRIMARY KEY,
  path_secret TEXT NOT NULL,
  -- Last committed seq; every accepted write takes the next one.
  seq INTEGER NOT NULL DEFAULT 0,
  -- Random id of the commit that took `seq`: the commit's guarded statements
  -- only run when the claim on `seq` was theirs.
  commit_nonce TEXT,
  snapshot_seq INTEGER NOT NULL DEFAULT 0,
  snapshot_key TEXT,
  owner_google_sub TEXT,
  owner_email TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  -- HMAC-SHA-256 of the bearer token; the token itself is never stored.
  token_hash TEXT NOT NULL UNIQUE,
  -- The church user it acts as; NULL for the church server (the PC).
  user_id TEXT,
  name TEXT NOT NULL,
  is_server INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX idx_devices_church ON devices(church_id);

CREATE TABLE roles (
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (church_id, id)
);

CREATE TABLE role_permissions (
  church_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (church_id, role_id, permission),
  FOREIGN KEY (church_id, role_id) REFERENCES roles(church_id, id) ON DELETE CASCADE
);

CREATE TABLE users (
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id TEXT,
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (church_id, id)
);

CREATE TABLE user_permissions (
  church_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (church_id, user_id, permission),
  FOREIGN KEY (church_id, user_id) REFERENCES users(church_id, id) ON DELETE CASCADE
);

-- One row per synced aggregate: its version is the seq of the last accepted
-- change. The content itself lives in the bucket, never here.
CREATE TABLE entities (
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  uuid TEXT NOT NULL,
  version INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  created_by TEXT,
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (church_id, type, uuid)
);

-- Every object the service wrote for a church (log segments and snapshots),
-- so head.json lists them and a path rotation deletes them without listing.
CREATE TABLE bucket_objects (
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('log', 'snap')),
  seq INTEGER NOT NULL,
  PRIMARY KEY (church_id, key)
);
CREATE INDEX idx_bucket_objects_seq ON bucket_objects(church_id, kind, seq);
