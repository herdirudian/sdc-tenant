-- CreateTable
CREATE TABLE `email_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('INVOICE_SENT', 'REMINDER_DUE_SOON', 'REMINDER_DUE_TOMORROW', 'REMINDER_OVERDUE') NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `dedupe_key` VARCHAR(191) NULL,
    `invoice_id` VARCHAR(191) NULL,
    `to_email` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `html` TEXT NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `send_after` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `last_attempt_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `locked_at` DATETIME(3) NULL,
    `locked_by` VARCHAR(64) NULL,
    `provider_message_id` VARCHAR(191) NULL,
    `created_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_outbox_dedupe_key_key`(`dedupe_key`),
    INDEX `email_outbox_status_scheduled_at_idx`(`status`, `scheduled_at`),
    INDEX `email_outbox_invoice_id_idx`(`invoice_id`),
    INDEX `email_outbox_locked_at_idx`(`locked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_outbox` ADD CONSTRAINT `email_outbox_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_outbox` ADD CONSTRAINT `email_outbox_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
