CREATE TABLE `programGenerationEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `programGenerationEvents_id` PRIMARY KEY(`id`)
);
