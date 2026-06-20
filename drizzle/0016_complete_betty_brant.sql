CREATE TABLE `stripeInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeInvoiceId` varchar(255) NOT NULL,
	`stripeSubscriptionId` varchar(255),
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'usd',
	`invoiceStatus` enum('draft','open','paid','void','uncollectible') NOT NULL,
	`paidAt` timestamp,
	`dueDate` timestamp,
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`invoiceUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeInvoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeInvoices_stripeInvoiceId_unique` UNIQUE(`stripeInvoiceId`)
);
