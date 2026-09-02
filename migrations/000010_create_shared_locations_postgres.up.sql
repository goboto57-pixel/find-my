CREATE TABLE IF NOT EXISTS shared_locations (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint,
  token text,
  encrypted_payload text,
  expires_at bigint,
  created_at bigint,
  CONSTRAINT fk_fmd_users_shared_locations FOREIGN KEY (user_id) REFERENCES fmd_users (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_locations_token ON shared_locations (token);
CREATE INDEX IF NOT EXISTS idx_shared_locations_user_id ON shared_locations (user_id);
