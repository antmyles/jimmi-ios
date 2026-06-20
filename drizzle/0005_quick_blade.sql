CREATE TABLE `accountSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planTier` enum('standard','premium') NOT NULL DEFAULT 'standard',
	`subscriptionStatus` enum('active','paused') NOT NULL DEFAULT 'active',
	`autoRenew` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accountSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `accountSettings_userId_unique` UNIQUE(`userId`)
);
