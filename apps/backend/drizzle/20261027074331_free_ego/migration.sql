ALTER TABLE `event_recurrence_exceptions` ADD `replacement_title` text;--> statement-breakpoint
ALTER TABLE `event_recurrence_exceptions` ADD `replacement_description` text;--> statement-breakpoint
ALTER TABLE `event_recurrence_exceptions` ADD `replacement_timezone` text;--> statement-breakpoint
ALTER TABLE `event_recurrence_exceptions` ADD `replacement_all_day` integer;--> statement-breakpoint
CREATE TRIGGER event_recurrence_exceptions_version_insert
AFTER INSERT ON event_recurrence_exceptions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'events';
END;--> statement-breakpoint
CREATE TRIGGER event_recurrence_exceptions_version_update
AFTER UPDATE ON event_recurrence_exceptions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'events';
END;--> statement-breakpoint
CREATE TRIGGER event_recurrence_exceptions_version_delete
AFTER DELETE ON event_recurrence_exceptions
BEGIN
    UPDATE versions SET value = value + 1 WHERE key = 'events';
END;
