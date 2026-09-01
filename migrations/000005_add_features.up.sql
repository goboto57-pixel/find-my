-- Adds columns for: device tags/display name (feature 5),
-- and TOTP/2FA (feature 7). Plain ALTER TABLE ADD COLUMN,
-- valid syntax on both SQLite and Postgres -- no dialect split needed.

ALTER TABLE fmd_users ADD COLUMN display_name text;
ALTER TABLE fmd_users ADD COLUMN tags text;
ALTER TABLE fmd_users ADD COLUMN totp_secret text;
ALTER TABLE fmd_users ADD COLUMN totp_enabled integer NOT NULL DEFAULT 0;
