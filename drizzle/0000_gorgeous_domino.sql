CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`broker` text NOT NULL,
	`label` text NOT NULL,
	`kind` text DEFAULT 'brokerage' NOT NULL,
	`book` text DEFAULT 'equity' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `annotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`label` text NOT NULL,
	`body` text,
	`kind` text DEFAULT 'life' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cluster_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cluster_tags_idx` ON `cluster_tags` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `designations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`bucket` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `designations_symbol_unique` ON `designations` (`symbol`);--> statement-breakpoint
CREATE TABLE `import_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`source` text NOT NULL,
	`sha256` text NOT NULL,
	`account_id` text,
	`imported_at` text NOT NULL,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`rows_deduped` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`warnings` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_files_sha_idx` ON `import_files` (`sha256`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`symbol` text,
	`account_id` text,
	`kind` text DEFAULT 'reflection' NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`conviction` integer,
	`exit_plan` text,
	`invalidation` text,
	`payload` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lot_closures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`open_date` text,
	`close_date` text NOT NULL,
	`close_tx_id` integer,
	`qty_micro` integer NOT NULL,
	`proceeds_cents` integer NOT NULL,
	`basis_cents` integer,
	`gain_cents` integer,
	`holding_days` integer,
	`orphan` integer DEFAULT false NOT NULL,
	`is_money_market` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `closures_account_idx` ON `lot_closures` (`account_id`,`close_date`);--> statement-breakpoint
CREATE INDEX `closures_symbol_idx` ON `lot_closures` (`symbol`);--> statement-breakpoint
CREATE TABLE `lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`open_date` text NOT NULL,
	`open_tx_id` integer,
	`qty_micro` integer NOT NULL,
	`remaining_micro` integer NOT NULL,
	`cost_cents` integer,
	`cost_remaining_cents` integer,
	`is_money_market` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lots_account_symbol_idx` ON `lots` (`account_id`,`symbol`);--> statement-breakpoint
CREATE TABLE `market_days` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`close_micro` integer NOT NULL,
	`high_micro` integer,
	`low_micro` integer,
	PRIMARY KEY(`symbol`, `date`)
);
--> statement-breakpoint
CREATE TABLE `option_fills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position_id` integer NOT NULL,
	`tx_id` integer NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `option_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`occ_key` text NOT NULL,
	`underlying` text NOT NULL,
	`expiry` text NOT NULL,
	`strike_micro` integer NOT NULL,
	`right` text NOT NULL,
	`direction` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`peak_contracts` integer NOT NULL,
	`open_premium_cents` integer NOT NULL,
	`close_premium_cents` integer NOT NULL,
	`realized_cents` integer,
	`fees_cents` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`outcome` text,
	`dte_at_open` integer,
	`strategy_label` text
);
--> statement-breakpoint
CREATE INDEX `optpos_account_idx` ON `option_positions` (`account_id`,`opened_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skipped_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_file_id` integer NOT NULL,
	`line_no` integer NOT NULL,
	`raw` text NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `swot_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_dividends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`account_no` text,
	`import_file_id` integer,
	`description` text NOT NULL,
	`symbol` text,
	`cusip` text,
	`date` text NOT NULL,
	`ordinary_cents` integer NOT NULL,
	`qualified_cents` integer,
	`dedupe_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_div_dedupe_idx` ON `tax_dividends` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `tax_forms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer,
	`account_no` text,
	`import_file_id` integer,
	`form` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`account_no` text,
	`import_file_id` integer,
	`description` text NOT NULL,
	`symbol` text,
	`cusip` text,
	`qty_micro` integer NOT NULL,
	`acquired` text NOT NULL,
	`sold` text NOT NULL,
	`proceeds_cents` integer NOT NULL,
	`basis_cents` integer,
	`wash_disallowed_cents` integer,
	`gain_cents` integer,
	`term` text NOT NULL,
	`basis_reported` integer NOT NULL,
	`dedupe_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_lots_dedupe_idx` ON `tax_lots` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `tax_lots_year_idx` ON `tax_lots` (`year`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`import_file_id` integer,
	`source` text NOT NULL,
	`tx_key` text NOT NULL,
	`key_ordinal` integer DEFAULT 0 NOT NULL,
	`date` text NOT NULL,
	`exec_time` text,
	`settle_date` text,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`symbol` text,
	`cusip` text,
	`description` text,
	`occ_key` text,
	`underlying` text,
	`expiry` text,
	`strike_micro` integer,
	`right` text,
	`multiplier` integer,
	`qty_micro` integer,
	`price_micro` integer,
	`amount_cents` integer,
	`fees_cents` integer,
	`commission_cents` integer,
	`cash_balance_cents` integer,
	`strategy_label` text,
	`raw` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tx_dedupe_idx` ON `transactions` (`account_id`,`tx_key`,`key_ordinal`);--> statement-breakpoint
CREATE INDEX `tx_account_date_idx` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `tx_symbol_idx` ON `transactions` (`symbol`);--> statement-breakpoint
CREATE INDEX `tx_type_idx` ON `transactions` (`type`);