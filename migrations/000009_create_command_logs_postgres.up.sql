CREATE TABLE IF NOT EXISTS command_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint,
  command text,
  status text,
  sent_at bigint,
  delivered_at bigint,
  resolved_at bigint,
  CONSTRAINT fk_fmd_users_command_logs FOREIGN KEY (user_id) REFERENCES fmd_users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs (user_id);
