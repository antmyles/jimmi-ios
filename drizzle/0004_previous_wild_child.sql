CREATE TABLE `exerciseLogEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`programId` int NOT NULL,
	`exerciseKey` varchar(120) NOT NULL,
	`exerciseName` text NOT NULL,
	`sets` int NOT NULL DEFAULT 0,
	`reps` int NOT NULL DEFAULT 0,
	`weight` int NOT NULL DEFAULT 0,
	`notes` text,
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exerciseLogEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jimmiPrograms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`macroCalories` int NOT NULL DEFAULT 0,
	`macroProtein` int NOT NULL DEFAULT 0,
	`macroCarbs` int NOT NULL DEFAULT 0,
	`macroFat` int NOT NULL DEFAULT 0,
	`planJson` text NOT NULL,
	`groceryListJson` text,
	`exportText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jimmiPrograms_id` PRIMARY KEY(`id`),
	CONSTRAINT `jimmiPrograms_userId_unique` UNIQUE(`userId`)
);
