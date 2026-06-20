DROP TABLE `chatMessages`;--> statement-breakpoint
DROP TABLE `mealLogs`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
DROP TABLE `workoutExercises`;--> statement-breakpoint
DROP TABLE `workoutLogs`;--> statement-breakpoint
ALTER TABLE `jimmiProfiles` MODIFY COLUMN `dietRestrictions` text NOT NULL;--> statement-breakpoint
ALTER TABLE `jimmiProfiles` MODIFY COLUMN `foodAllergies` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `timezone`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `preferredHour`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `workoutReminderEnabled`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `mealReminderEnabled`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `calorieTarget`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `proteinTarget`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `carbTarget`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `fatTarget`;