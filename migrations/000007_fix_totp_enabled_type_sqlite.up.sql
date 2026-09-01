-- No-op on SQLite: SQLite is dynamically typed, so the `integer` column
-- created by 000005_add_features already round-trips correctly with Go's
-- `bool` (0/1). The bug this migration fixes is Postgres-specific -- see
-- 000007_fix_totp_enabled_type_postgres.up.sql for details.
SELECT 1;
