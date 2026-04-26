-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `pph_attachment_url` VARCHAR(1024) NULL,
    ADD COLUMN `pph_billing_id` VARCHAR(64) NULL,
    ADD COLUMN `pph_ntpn` VARCHAR(64) NULL,
    ADD COLUMN `pph_paid_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `company_settings` (
    `id` VARCHAR(32) NOT NULL DEFAULT 'default',
    `company_name` VARCHAR(191) NOT NULL,
    `npwp` VARCHAR(32) NULL,
    `address` TEXT NULL,
    `logo_url` VARCHAR(1024) NULL,
    `signature_name` VARCHAR(191) NULL,
    `signature_title` VARCHAR(191) NULL,
    `default_due_days` INTEGER NOT NULL DEFAULT 14,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `company_settings_id` VARCHAR(32) NOT NULL DEFAULT 'default',
    `label` VARCHAR(191) NOT NULL,
    `account_name` VARCHAR(191) NOT NULL,
    `account_number` VARCHAR(64) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bank_accounts_company_settings_id_idx`(`company_settings_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` ENUM('TRANSFER', 'CASH', 'OTHER') NOT NULL DEFAULT 'TRANSFER',
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `invoice_payments_invoice_id_idx`(`invoice_id`),
    INDEX `invoice_payments_paid_at_idx`(`paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_company_settings_id_fkey` FOREIGN KEY (`company_settings_id`) REFERENCES `company_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_payments` ADD CONSTRAINT `invoice_payments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
