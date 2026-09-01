-- Multi-device support, step 1: an `accounts` table that a person logs
-- into on the web, independent of any single device's own credentials.
-- Each existing `fmd_users` row keeps working exactly as before (it IS
-- a device, with its own salt/keys/commands) -- this just adds an
-- optional link from a device to the account that manages it. Devices
-- with no account_id keep behaving as single-device logins, so this is
-- backward compatible with every existing deployment.

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `uid` text,
  `salt` text,
  `hashed_password` text,
  `created_at` integer
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_accounts_uid` ON `accounts` (`uid`);

ALTER TABLE fmd_users ADD COLUMN account_id integer REFERENCES accounts (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS `idx_fmd_users_account_id` ON `fmd_users` (`account_id`);
