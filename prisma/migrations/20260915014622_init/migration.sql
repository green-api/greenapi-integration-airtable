-- CreateTable
CREATE TABLE `Base` (
    `id` VARCHAR(191) NOT NULL,
    `inbound` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AirtableAuth` (
    `baseId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `refreshExpiresAt` DATETIME(3) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`baseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthState` (
    `state` VARCHAR(191) NOT NULL,
    `baseId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('base', 'user') NOT NULL DEFAULT 'base',
    `codeVerifier` VARCHAR(191) NOT NULL,
    `pendingKey` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`state`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BaseUser` (
    `id` VARCHAR(191) NOT NULL,
    `baseId` VARCHAR(191) NOT NULL,
    `airtableUserId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `permissionLevel` ENUM('none', 'read', 'comment', 'edit', 'create', 'interfaceOnly') NOT NULL,
    `keyHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BaseUser_keyHash_key`(`keyHash`),
    UNIQUE INDEX `BaseUser_baseId_airtableUserId_key`(`baseId`, `airtableUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserInstance` (
    `userId` VARCHAR(191) NOT NULL,
    `idInstance` BIGINT NOT NULL,

    PRIMARY KEY (`userId`, `idInstance`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Instance` (
    `idInstance` BIGINT NOT NULL,
    `apiTokenInstance` VARCHAR(191) NOT NULL,
    `apiUrl` VARCHAR(191) NOT NULL,
    `stateInstance` ENUM('notAuthorized', 'authorized', 'yellowCard', 'blocked', 'starting', 'suspended', 'pendingPassword') NULL,
    `messenger` ENUM('whatsapp', 'telegram', 'max') NOT NULL,
    `phone` VARCHAR(191) NULL,
    `checkedAt` DATETIME(3) NULL,
    `settings` JSON NULL,
    `name` VARCHAR(191) NULL,
    `receiveWebhooks` BOOLEAN NOT NULL DEFAULT false,
    `baseId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Instance_baseId_idx`(`baseId`),
    PRIMARY KEY (`idInstance`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SendJob` (
    `id` VARCHAR(191) NOT NULL,
    `baseId` VARCHAR(191) NOT NULL,
    `idInstance` BIGINT NOT NULL,
    `status` ENUM('queued', 'running', 'done', 'cancelled') NOT NULL DEFAULT 'queued',
    `total` INTEGER NOT NULL,
    `sent` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `writeBack` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `SendJob_baseId_createdAt_idx`(`baseId`, `createdAt`),
    INDEX `SendJob_idInstance_status_idx`(`idInstance`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SendJobItem` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `recordId` VARCHAR(191) NULL,
    `chatId` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `status` ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
    `idMessage` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,

    INDEX `SendJobItem_jobId_position_idx`(`jobId`, `position`),
    INDEX `SendJobItem_idMessage_idx`(`idMessage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationKey` (
    `id` VARCHAR(191) NOT NULL,
    `baseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `idInstance` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AutomationKey_keyHash_key`(`keyHash`),
    INDEX `AutomationKey_baseId_idx`(`baseId`),
    INDEX `AutomationKey_idInstance_idx`(`idInstance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AirtableAuth` ADD CONSTRAINT `AirtableAuth_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BaseUser` ADD CONSTRAINT `BaseUser_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInstance` ADD CONSTRAINT `UserInstance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `BaseUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserInstance` ADD CONSTRAINT `UserInstance_idInstance_fkey` FOREIGN KEY (`idInstance`) REFERENCES `Instance`(`idInstance`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Instance` ADD CONSTRAINT `Instance_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SendJob` ADD CONSTRAINT `SendJob_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SendJob` ADD CONSTRAINT `SendJob_idInstance_fkey` FOREIGN KEY (`idInstance`) REFERENCES `Instance`(`idInstance`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SendJobItem` ADD CONSTRAINT `SendJobItem_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `SendJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationKey` ADD CONSTRAINT `AutomationKey_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationKey` ADD CONSTRAINT `AutomationKey_idInstance_fkey` FOREIGN KEY (`idInstance`) REFERENCES `Instance`(`idInstance`) ON DELETE CASCADE ON UPDATE CASCADE;

