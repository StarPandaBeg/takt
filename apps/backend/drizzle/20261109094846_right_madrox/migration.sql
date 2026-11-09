CREATE TABLE `diagnostic_coredumps` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`device_id` text NOT NULL,
	`boot_id` text NOT NULL,
	`dump_id` text NOT NULL,
	`firmware_version` text,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `diagnostic_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`device_id` text NOT NULL,
	`record_id` text NOT NULL,
	`boot_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`firmware_version` text,
	`git_sha` text,
	`record_type` text NOT NULL,
	`level` text,
	`source` text,
	`module` text,
	`message` text,
	`uptime_ms` integer,
	`timestamp_unix_ms` integer,
	`fields_json` text,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diagnostic_coredumps_device_dump_unique` ON `diagnostic_coredumps` (`device_id`,`dump_id`);--> statement-breakpoint
CREATE INDEX `diagnostic_coredumps_received_at_idx` ON `diagnostic_coredumps` (`received_at`);--> statement-breakpoint
CREATE INDEX `diagnostic_coredumps_boot_id_idx` ON `diagnostic_coredumps` (`boot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `diagnostic_records_device_record_unique` ON `diagnostic_records` (`device_id`,`record_id`);--> statement-breakpoint
CREATE INDEX `diagnostic_records_received_at_idx` ON `diagnostic_records` (`received_at`);--> statement-breakpoint
CREATE INDEX `diagnostic_records_level_idx` ON `diagnostic_records` (`level`);--> statement-breakpoint
CREATE INDEX `diagnostic_records_type_idx` ON `diagnostic_records` (`record_type`);--> statement-breakpoint
CREATE INDEX `diagnostic_records_module_idx` ON `diagnostic_records` (`module`);--> statement-breakpoint
CREATE INDEX `diagnostic_records_boot_id_idx` ON `diagnostic_records` (`boot_id`);--> statement-breakpoint
CREATE INDEX `diagnostic_records_sequence_idx` ON `diagnostic_records` (`sequence`);
