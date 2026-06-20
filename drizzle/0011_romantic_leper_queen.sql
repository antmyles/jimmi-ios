ALTER TABLE `wearableConnections` ADD `accessToken` text;--> statement-breakpoint
ALTER TABLE `wearableConnections` ADD `refreshToken` text;--> statement-breakpoint
ALTER TABLE `wearableConnections` ADD `tokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `wearableConnections` ADD `scope` text;