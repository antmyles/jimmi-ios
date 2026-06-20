ALTER TABLE `jimmiProfiles` ADD `eventType` varchar(40) DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `jimmiProfiles` ADD `weeksUntilRace` int;--> statement-breakpoint
ALTER TABLE `jimmiProfiles` ADD `currentWeeklyVolume` varchar(80);--> statement-breakpoint
ALTER TABLE `jimmiProfiles` ADD `previousRaceTimes` text;--> statement-breakpoint
ALTER TABLE `jimmiProfiles` ADD `availableTrainingDaysPerWeek` int;