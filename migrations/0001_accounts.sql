-- Accounts and cloud saves (D1). Apply with: npx wrangler d1 migrations apply simproject --local   (or --remote for the live database)
-- One user can have several identities (Google, an email address, later Discord). Sessions store only a hash of the cookie's token.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE identities (
  provider TEXT NOT NULL,          -- 'google', 'email', 'dev'
  subject TEXT NOT NULL,           -- the provider's stable id for the person (Google 'sub', the lower-case email address)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,                      -- verified email, lower case, when the provider gave one
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX identities_user ON identities(user_id);
CREATE INDEX identities_email ON identities(email);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,     -- SHA-256 of the cookie token, hex
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE saves (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,              -- the save file envelope (dist/save-file.js), as JSON
  game TEXT,                       -- the game version that wrote it
  saved_at INTEGER NOT NULL,
  revision INTEGER NOT NULL        -- +1 on every write; a write must name the revision it started from
);
