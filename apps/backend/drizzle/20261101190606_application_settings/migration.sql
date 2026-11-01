CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `settings` (`key`, `value`, `created_at`, `updated_at`)
VALUES ('timezone', 'Europe/Moscow', unixepoch('subsec') * 1000, unixepoch('subsec') * 1000);
