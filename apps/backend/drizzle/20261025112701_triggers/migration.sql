INSERT INTO versions (key, value)
VALUES
    ('notes', 0),
    ('events', 0),
    ('deadlines', 0);

--> statement-breakpoint

CREATE TRIGGER notes_version_insert
AFTER INSERT ON notes
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'notes';
END;

--> statement-breakpoint

CREATE TRIGGER notes_version_update
AFTER UPDATE ON notes
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'notes';
END;

--> statement-breakpoint

CREATE TRIGGER notes_version_delete
AFTER DELETE ON notes
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'notes';
END;

--> statement-breakpoint

CREATE TRIGGER events_version_insert
AFTER INSERT ON events
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'events';
END;

--> statement-breakpoint

CREATE TRIGGER events_version_update
AFTER UPDATE ON events
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'events';
END;

--> statement-breakpoint

CREATE TRIGGER events_version_delete
AFTER DELETE ON events
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'events';
END;

--> statement-breakpoint

CREATE TRIGGER deadlines_version_insert
AFTER INSERT ON deadlines
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'deadlines';
END;

--> statement-breakpoint

CREATE TRIGGER deadlines_version_update
AFTER UPDATE ON deadlines
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'deadlines';
END;

--> statement-breakpoint

CREATE TRIGGER deadlines_version_delete
AFTER DELETE ON deadlines
BEGIN
    UPDATE versions
    SET value = value + 1
    WHERE key = 'deadlines';
END;