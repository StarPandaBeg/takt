CREATE TABLE `event_recurrence_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`event_id` integer NOT NULL,
	`recurrence_id` integer NOT NULL,
	`replacement_start` integer,
	`replacement_end` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_event_recurrence_exceptions_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `events` ADD `recurrence_rule` text;--> statement-breakpoint
CREATE UNIQUE INDEX `event_recurrence_exception_occurrence_unique` ON `event_recurrence_exceptions` (`event_id`,`recurrence_id`);