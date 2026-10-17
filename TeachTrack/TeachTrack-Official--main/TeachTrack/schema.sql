CREATE TABLE IF NOT EXISTS tt_users (id text PRIMARY KEY, username text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','teacher')), name text NOT NULL, enabled boolean NOT NULL DEFAULT true, session_id text, session_expires timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS tt_users_lower_username ON tt_users(lower(username));
CREATE TABLE IF NOT EXISTS tt_documents(path text PRIMARY KEY, collection text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE INDEX IF NOT EXISTS tt_documents_collection ON tt_documents(collection);
