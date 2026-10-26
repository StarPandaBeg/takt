CREATE TABLE `deadline_recurrence_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`deadline_id` integer NOT NULL,
	`recurrence_id` integer NOT NULL,
	`replacement_due` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_deadline_recurrence_exceptions_deadline_id_deadlines_id_fk` FOREIGN KEY (`deadline_id`) REFERENCES `deadlines`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deadline_recurrence_exception_occurrence_unique` ON `deadline_recurrence_exceptions` (`deadline_id`,`recurrence_id`);