-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `approval_status` ENUM('DRAFT', 'APPROVED', 'SENT') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `approved_at` DATETIME(3) NULL,
    ADD COLUMN `sent_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `invoices_approval_status_idx` ON `invoices`(`approval_status`);

-- CreateIndex
CREATE INDEX `users_is_active_idx` ON `users`(`is_active`);
