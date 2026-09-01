-- Postgres-dialect equivalent of 000008_add_accounts_sqlite.up.sql.
-- See that file for the rationale.

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  uid text,
  salt text,
  hashed_password text,
  created_at bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_uid ON accounts (uid);

ALTER TABLE fmd_users ADD COLUMN account_id bigint REFERENCES accounts (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_fmd_users_account_id ON fmd_users (account_id);
