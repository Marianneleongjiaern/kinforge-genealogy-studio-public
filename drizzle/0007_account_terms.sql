ALTER TABLE `accounts` ADD COLUMN `terms_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `accounts` ADD COLUMN `terms_version` text;
--> statement-breakpoint
ALTER TABLE `accounts` ADD COLUMN `privacy_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `accounts` ADD COLUMN `privacy_version` text;
