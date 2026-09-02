CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id bigint,
  endpoint text,
  p256dh text,
  auth text,
  created_at bigint,
  CONSTRAINT fk_fmd_users_web_push_subscriptions FOREIGN KEY (user_id) REFERENCES fmd_users (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_push_subscriptions_endpoint ON web_push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id ON web_push_subscriptions (user_id);
