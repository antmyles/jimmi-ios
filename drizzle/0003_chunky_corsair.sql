CREATE TABLE `foodLogEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logDate` varchar(10) NOT NULL,
	`mealType` varchar(32) NOT NULL,
	`foodName` text NOT NULL,
	`calories` int NOT NULL DEFAULT 0,
	`protein` int NOT NULL DEFAULT 0,
	`carbs` int NOT NULL DEFAULT 0,
	`fat` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `foodLogEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jimmiProfiles` ADD `targetWeight` int;--> statement-breakpoint
ALTER TABLE `jimmiProfiles` ADD `avatarUrl` text;