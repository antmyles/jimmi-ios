CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jimmiProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`firstName` varchar(120) NOT NULL,
	`birthday` varchar(20) NOT NULL,
	`gender` varchar(40) NOT NULL,
	`weight` int NOT NULL,
	`height` varchar(20) NOT NULL,
	`healthComplications` text NOT NULL,
	`dietRestrictions` varchar(80) NOT NULL,
	`foodAllergies` varchar(80) NOT NULL,
	`fitnessLevel` varchar(80) NOT NULL,
	`activityLevel` varchar(80) NOT NULL DEFAULT 'moderate',
	`fitnessGoals` text NOT NULL,
	`additionalInfo` text,
	`tourSeen` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jimmiProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `jimmiProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `mealLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`mealType` varchar(60) NOT NULL DEFAULT 'meal',
	`mealDate` timestamp NOT NULL DEFAULT (now()),
	`calories` int NOT NULL DEFAULT 0,
	`protein` int NOT NULL DEFAULT 0,
	`carbs` int NOT NULL DEFAULT 0,
	`fat` int NOT NULL DEFAULT 0,
	`source` varchar(80) NOT NULL DEFAULT 'manual',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mealLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeSubscriptionId` varchar(191),
	`status` varchar(60) NOT NULL DEFAULT 'trialing',
	`trialEndsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `workoutExercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workoutId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`sets` int NOT NULL DEFAULT 0,
	`reps` int NOT NULL DEFAULT 0,
	`weight` int NOT NULL DEFAULT 0,
	`durationMinutes` int NOT NULL DEFAULT 0,
	CONSTRAINT `workoutExercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workoutLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`workoutDate` timestamp NOT NULL DEFAULT (now()),
	`durationMinutes` int NOT NULL DEFAULT 0,
	`totalVolume` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workoutLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(80) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredHour` int DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `workoutReminderEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mealReminderEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `calorieTarget` int DEFAULT 2200 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `proteinTarget` int DEFAULT 180 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `carbTarget` int DEFAULT 220 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `fatTarget` int DEFAULT 70 NOT NULL;