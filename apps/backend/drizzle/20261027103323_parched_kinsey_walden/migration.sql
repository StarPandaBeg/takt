CREATE TABLE `deadline_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`deadline_id` integer NOT NULL,
	`recurrence_id` integer,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_deadline_completions_deadline_id_deadlines_id_fk` FOREIGN KEY (`deadline_id`) REFERENCES `deadlines`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `deadlines` ADD `visibility_show` text DEFAULT 'always' NOT NULL;--> statement-breakpoint
ALTER TABLE `deadlines` ADD `visibility_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `deadlines` ADD `visibility_hide` text DEFAULT 'on_due' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `deadline_completion_occurrence_unique` ON `deadline_completions` (`deadline_id`,`recurrence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `deadline_completion_master_unique` ON `deadline_completions` (`deadline_id`) WHERE `recurrence_id` IS NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `deadline_completions`
    (`deadline_id`, `recurrence_id`, `completed_at`, `created_at`, `updated_at`)
SELECT `id`, NULL, `updated_at`, `updated_at`, `updated_at`
FROM `deadlines`
WHERE `completed` = 1;--> statement-breakpoint
INSERT OR IGNORE INTO `deadline_completions`
    (`deadline_id`, `recurrence_id`, `completed_at`, `created_at`, `updated_at`)
SELECT `deadline_id`, `recurrence_id`, `updated_at`, `updated_at`, `updated_at`
FROM `deadline_recurrence_exceptions`
WHERE `replacement_completed` = 1;--> statement-breakpoint
UPDATE `deadlines` SET `completed` = 0 WHERE `completed` = 1;--> statement-breakpoint
UPDATE `deadline_recurrence_exceptions`
SET `replacement_completed` = NULL
WHERE `replacement_completed` IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER deadline_completions_version_insert
AFTER INSERT ON deadline_completions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'deadlines';
END;--> statement-breakpoint
CREATE TRIGGER deadline_completions_version_update
AFTER UPDATE ON deadline_completions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'deadlines';
END;--> statement-breakpoint
CREATE TRIGGER deadline_completions_version_delete
AFTER DELETE ON deadline_completions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'deadlines';
END;
