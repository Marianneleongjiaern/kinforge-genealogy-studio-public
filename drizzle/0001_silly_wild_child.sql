CREATE TABLE `drive_authorizations` (
	`hash` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`provider` text NOT NULL,
	`verifier` text NOT NULL,
	`browser_hash` text,
	`phase` text DEFAULT 'start' NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drive_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`provider` text NOT NULL,
	`credentials` text NOT NULL,
	`folder_id` text,
	`manifest_id` text,
	`manifest_hash` text,
	`synced_revision` integer DEFAULT -1 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`last_sync` integer,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`retry_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_connections_library_provider` ON `drive_connections` (`library_id`,`provider`);--> statement-breakpoint
CREATE TABLE `drive_files` (
	`connection_id` text NOT NULL,
	`path` text NOT NULL,
	`remote_id` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`connection_id`, `path`),
	FOREIGN KEY (`connection_id`) REFERENCES `drive_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `library_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`mime` text NOT NULL,
	`object_key` text NOT NULL,
	`hash` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `library_exports_library` ON `library_exports` (`library_id`,`created_at`);