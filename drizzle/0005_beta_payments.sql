CREATE TABLE `beta_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`stripe_payment_id` text,
	`plan` text NOT NULL,
	`interval` text NOT NULL,
	`currency` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`discount_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `beta_payments_account` ON `beta_payments` (`account_id`);
--> statement-breakpoint
CREATE INDEX `beta_payments_created` ON `beta_payments` (`created_at`);
