ALTER TABLE `deadline_recurrence_exceptions` ADD `replacement_title` text;--> statement-breakpoint
ALTER TABLE `deadline_recurrence_exceptions` ADD `replacement_description` text;--> statement-breakpoint
ALTER TABLE `deadline_recurrence_exceptions` ADD `replacement_due_is_date` integer;--> statement-breakpoint
ALTER TABLE `deadline_recurrence_exceptions` ADD `replacement_timezone` text;--> statement-breakpoint
ALTER TABLE `deadline_recurrence_exceptions` ADD `replacement_completed` integer;--> statement-breakpoint
ALTER TABLE `deadlines` ADD `cancelled_at` integer;--> statement-breakpoint
CREATE TRIGGER deadline_recurrence_exceptions_version_insert
AFTER INSERT ON deadline_recurrence_exceptions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'deadlines';
END;--> statement-breakpoint
CREATE TRIGGER deadline_recurrence_exceptions_version_update
AFTER UPDATE ON deadline_recurrence_exceptions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'deadlines';
END;--> statement-breakpoint
CREATE TRIGGER deadline_recurrence_exceptions_version_delete
AFTER DELETE ON deadline_recurrence_exceptions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'deadlines';
END;
