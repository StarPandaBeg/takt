ALTER TABLE `deadlines` ADD `timezone` text DEFAULT 'Europe/Moscow' NOT NULL;--> statement-breakpoint
ALTER TABLE `deadlines` ADD `recurrence_rule` text;