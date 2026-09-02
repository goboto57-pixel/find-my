CREATE TABLE IF NOT EXISTS `command_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `user_id` integer,
  `command` text,
  `status` text,
  `sent_at` integer,
  `delivered_at` integer,
  `resolved_at` integer,
  CONSTRAINT `fk_fmd_users_command_logs` FOREIGN KEY (`user_id`) REFERENCES `fmd_users` (`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `idx_command_logs_user_id` ON `command_logs` (`user_id`);
