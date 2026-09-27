CREATE TABLE IF NOT EXISTS `stripe_customers` (
	`account_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `stripe_customers_customer` ON `stripe_customers` (`stripe_customer_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `beta_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text,
	`stripe_payment_id` text,
	`plan` text NOT NULL,
	`interval` text,
	`currency` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`discount_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `beta_payments_account_created` ON `beta_payments` (`account_id`,`created_at`);
