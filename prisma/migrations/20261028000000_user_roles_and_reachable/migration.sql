-- AlterTable
ALTER TABLE `AirtableAuth` ADD COLUMN `airtableUserId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BaseUser` ADD COLUMN `roleCheckedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Instance` ADD COLUMN `reachable` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `UserAuth` (
    `userId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `refreshExpiresAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserAuth` ADD CONSTRAINT `UserAuth_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `BaseUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

