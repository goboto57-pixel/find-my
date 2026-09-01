CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint,
  event text,
  remote_ip text,
  created_at bigint,
  CONSTRAINT fk_fmd_users_audit_logs FOREIGN KEY (user_id) REFERENCES fmd_users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
