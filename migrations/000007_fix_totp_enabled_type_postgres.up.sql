-- Fixes a type mismatch introduced by 000005_add_features: on Postgres,
-- totp_enabled was created as `integer`, but the Go struct field
-- (FMDUser.TotpEnabled) is a `bool`. The pgx driver is strictly typed and
-- refuses to encode a Go bool into a Postgres int4 column, which made every
-- INSERT into fmd_users fail silently (0 rows affected) on Postgres-backed
-- installs -- i.e. registration appeared to succeed on the client (keys
-- were generated locally) but no user was ever persisted server-side.
--
-- This converts the column to a real boolean, preserving existing values
-- (0 -> false, any non-zero -> true).
ALTER TABLE fmd_users
    ALTER COLUMN totp_enabled DROP DEFAULT,
    ALTER COLUMN totp_enabled TYPE boolean USING (totp_enabled <> 0),
    ALTER COLUMN totp_enabled SET DEFAULT false;
