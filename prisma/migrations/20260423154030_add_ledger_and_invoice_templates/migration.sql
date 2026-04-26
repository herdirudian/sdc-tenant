-- AlterTable
ALTER TABLE `company_settings` ADD COLUMN `invoice_footer` TEXT NULL,
    ADD COLUMN `invoice_terms` TEXT NULL;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `footer` TEXT NULL,
    ADD COLUMN `po_reference` VARCHAR(128) NULL,
    ADD COLUMN `template` ENUM('DEFAULT', 'MODERN') NOT NULL DEFAULT 'DEFAULT',
    ADD COLUMN `terms` TEXT NULL;

-- CreateTable
CREATE TABLE `invoice_bank_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `bank_account_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_bank_accounts_invoice_id_idx`(`invoice_id`),
    INDEX `invoice_bank_accounts_bank_account_id_idx`(`bank_account_id`),
    UNIQUE INDEX `invoice_bank_accounts_invoice_id_bank_account_id_key`(`invoice_id`, `bank_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `category` VARCHAR(64) NOT NULL,
    `description` TEXT NOT NULL,
    `vendor` VARCHAR(191) NULL,
    `reference` VARCHAR(128) NULL,
    `payment_method` ENUM('TRANSFER', 'CASH', 'OTHER') NOT NULL DEFAULT 'TRANSFER',
    `created_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expenses_occurred_at_idx`(`occurred_at`),
    INDEX `expenses_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `account` VARCHAR(64) NOT NULL,
    `description` TEXT NOT NULL,
    `reference` VARCHAR(128) NULL,
    `invoice_id` VARCHAR(191) NULL,
    `payment_id` VARCHAR(191) NULL,
    `expense_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ledger_entries_payment_id_key`(`payment_id`),
    UNIQUE INDEX `ledger_entries_expense_id_key`(`expense_id`),
    INDEX `ledger_entries_occurred_at_idx`(`occurred_at`),
    INDEX `ledger_entries_type_idx`(`type`),
    INDEX `ledger_entries_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `invoices_template_idx` ON `invoices`(`template`);

-- AddForeignKey
ALTER TABLE `invoice_bank_accounts` ADD CONSTRAINT `invoice_bank_accounts_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_bank_accounts` ADD CONSTRAINT `invoice_bank_accounts_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `invoice_payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
