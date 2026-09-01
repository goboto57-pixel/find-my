DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fmd_users' AND column_name = 'uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fmd_users' AND column_name = 'username'
  ) THEN
    ALTER TABLE fmd_users RENAME COLUMN uid TO username;
  END IF;
END $$;
