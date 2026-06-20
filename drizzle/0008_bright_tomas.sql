CREATE TABLE `calorieOutSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logDate` varchar(10) NOT NULL,
	`activeCalories` int NOT NULL DEFAULT 0,
	`restingCalories` int NOT NULL DEFAULT 0,
	`totalCalories` int NOT NULL DEFAULT 0,
	`sourceProvider` varchar(64) NOT NULL DEFAULT 'terra',
	`calorieOutSourceConfidence` enum('synced','estimated','manual','beta') NOT NULL DEFAULT 'beta',
	`wearableConnectionId` int,
	`rawPayloadKey` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calorieOutSummaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wearableConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(64) NOT NULL DEFAULT 'terra',
	`externalUserId` varchar(180),
	`wearableConnectionStatus` enum('connected','disconnected','pending') NOT NULL DEFAULT 'connected',
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wearableConnections_id` PRIMARY KEY(`id`)
);
