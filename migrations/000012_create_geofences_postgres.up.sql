CREATE TABLE IF NOT EXISTS geofences (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint,
  name text,
  lat double precision,
  lon double precision,
  radius_meters double precision,
  enabled boolean,
  created_at bigint,
  CONSTRAINT fk_fmd_users_geofences FOREIGN KEY (user_id) REFERENCES fmd_users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON geofences (user_id);
