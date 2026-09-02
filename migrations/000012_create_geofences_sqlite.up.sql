CREATE TABLE IF NOT EXISTS `geofences` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `user_id` integer,
  `name` text,
  `lat` real,
  `lon` real,
  `radius_meters` real,
  `enabled` integer,
  `created_at` integer,
  CONSTRAINT `fk_fmd_users_geofences` FOREIGN KEY (`user_id`) REFERENCES `fmd_users` (`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `idx_geofences_user_id` ON `geofences` (`user_id`);
