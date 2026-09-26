CREATE TABLE `beta_interests` (
	`account_id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`interval` text NOT NULL,
	`discount_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
