-- CreateTable
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `baseId` VARCHAR(191) NOT NULL,
    `idInstance` BIGINT NOT NULL,
    `minutes` INTEGER NOT NULL,
    `status` ENUM('queued', 'running', 'done', 'failed') NOT NULL DEFAULT 'queued',
    `total` INTEGER NULL,
    `imported` INTEGER NOT NULL DEFAULT 0,
    `skipped` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `ImportJob_idInstance_status_idx`(`idInstance`, `status`),
    INDEX `ImportJob_baseId_createdAt_idx`(`baseId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_idInstance_fkey` FOREIGN KEY (`idInstance`) REFERENCES `Instance`(`idInstance`) ON DELETE CASCADE ON UPDATE CASCADE;

