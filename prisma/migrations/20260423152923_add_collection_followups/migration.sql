-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `next_follow_up_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `invoice_follow_ups` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `created_by_user_id` VARCHAR(191) NULL,
    `note` TEXT NOT NULL,
    `next_follow_up_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_follow_ups_invoice_id_idx`(`invoice_id`),
    INDEX `invoice_follow_ups_next_follow_up_at_idx`(`next_follow_up_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `invoices_next_follow_up_at_idx` ON `invoices`(`next_follow_up_at`);

-- AddForeignKey
ALTER TABLE `invoice_follow_ups` ADD CONSTRAINT `invoice_follow_ups_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_follow_ups` ADD CONSTRAINT `invoice_follow_ups_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
