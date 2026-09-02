CREATE TABLE IF NOT EXISTS `web_push_subscriptions` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `user_id` integer,
  `endpoint` text,
  `p256dh` text,
  `auth` text,
  `created_at` integer,
  CONSTRAINT `fk_fmd_users_web_push_subscriptions` FOREIGN KEY (`user_id`) REFERENCES `fmd_users` (`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_web_push_subscriptions_endpoint` ON `web_push_subscriptions` (`endpoint`);
CREATE INDEX IF NOT EXISTS `idx_web_push_subscriptions_user_id` ON `web_push_subscriptions` (`user_id`);
