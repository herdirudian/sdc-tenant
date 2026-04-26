-- AlterTable
ALTER TABLE `company_settings` ADD COLUMN `smtp_from` VARCHAR(191) NULL,
    ADD COLUMN `smtp_host` VARCHAR(191) NULL,
    ADD COLUMN `smtp_pass_enc` TEXT NULL,
    ADD COLUMN `smtp_port` INTEGER NULL,
    ADD COLUMN `smtp_secure` BOOLEAN NULL,
    ADD COLUMN `smtp_user` VARCHAR(191) NULL;
