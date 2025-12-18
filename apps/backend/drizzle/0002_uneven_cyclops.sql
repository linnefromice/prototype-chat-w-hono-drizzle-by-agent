ALTER TABLE `messages` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `deleted_by_user_id` text REFERENCES users(id);