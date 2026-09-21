import { Injectable } from "@nestjs/common";
import { generateRandomToken, GreenApiLogger } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { AirtableIdentity } from "../airtable-api/airtable-auth.service";
import { hashKey } from "../bases/base-key";
import { apiError, ErrorCode } from "../errors";
import { ADMIN_PERMISSION_LEVELS, BASE_KEY_BYTES, PERSONAL_KEY_PREFIX, SENDER_PERMISSION_LEVELS } from "../defaults";
import { UserView, UserWithInstances } from "../types";

const withInstances = {instances: true} as const;

export function toUserView(user: UserWithInstances): UserView {
	return {
		id: user.id,
		airtableUserId: user.airtableUserId,
		email: user.email,
		name: user.name,
		permissionLevel: user.permissionLevel,
		isAdmin: (ADMIN_PERMISSION_LEVELS as readonly string[]).includes(user.permissionLevel),
		idInstances: user.instances.map(link => Number(link.idInstance)),
		hasKey: user.keyHash !== null,
		lastSeenAt: user.lastSeenAt.toISOString(),
	};
}

@Injectable()
export class UsersService {
	private readonly logger = GreenApiLogger.getInstance(UsersService.name);

	constructor(private readonly prisma: PrismaService) {}

	async issuePersonalKey(baseId: string, identity: AirtableIdentity): Promise<{ key: string; user: UserWithInstances }> {
		if (!(SENDER_PERMISSION_LEVELS as readonly string[]).includes(identity.permissionLevel)) {
			throw apiError(ErrorCode.USER_NOT_MEMBER, "This Airtable account cannot edit the base, so it cannot send from it", 403);
		}
		const key = `${PERSONAL_KEY_PREFIX}${generateRandomToken(BASE_KEY_BYTES)}`;
		await this.prisma.base.upsert({where: {id: baseId}, update: {}, create: {id: baseId}});
		const data = {email: identity.email, permissionLevel: identity.permissionLevel, keyHash: hashKey(key), lastSeenAt: new Date()};
		const user = await this.prisma.baseUser.upsert({
			where: {baseId_airtableUserId: {baseId, airtableUserId: identity.id}},
			update: data,
			create: {baseId, airtableUserId: identity.id, ...data},
			include: withInstances,
		});
		this.logger.info("Personal key issued", {baseId, userId: user.id, permissionLevel: identity.permissionLevel});
		return {key, user};
	}

	async findByKey(key: string): Promise<UserWithInstances | null> {
		return this.prisma.baseUser.findUnique({where: {keyHash: hashKey(key)}, include: withInstances});
	}

	async touch(userId: string): Promise<void> {
		await this.prisma.baseUser.update({where: {id: userId}, data: {lastSeenAt: new Date()}});
	}

	async list(baseId: string): Promise<UserView[]> {
		const users = await this.prisma.baseUser.findMany({where: {baseId}, orderBy: {createdAt: "asc"}, include: withInstances});
		return users.map(toUserView);
	}

	async setInstances(baseId: string, userId: string, idInstances: number[]): Promise<UserView> {
		const target = await this.getOwned(baseId, userId);
		if ((ADMIN_PERMISSION_LEVELS as readonly string[]).includes(target.permissionLevel)) {
			throw apiError(ErrorCode.VALIDATION_FAILED, "Owners and creators may use every instance; there is nothing to restrict", 400);
		}
		const unique = [...new Set(idInstances)];
		for (const idInstance of unique) {
			const instance = await this.prisma.getInstance(idInstance);
			if (!instance || instance.baseId !== baseId) {
				throw apiError(ErrorCode.INSTANCE_NOT_FOUND, `Instance ${idInstance} is not connected to this base`, 404);
			}
		}
		const user = await this.prisma.$transaction(async tx => {
			await tx.userInstance.deleteMany({where: {userId}});
			if (unique.length > 0) {
				await tx.userInstance.createMany({data: unique.map(idInstance => ({userId, idInstance: BigInt(idInstance)}))});
			}
			return tx.baseUser.findUniqueOrThrow({where: {id: userId}, include: withInstances});
		});
		this.logger.info("User instances updated", {baseId, userId, idInstances: unique});
		return toUserView(user);
	}

	async revoke(baseId: string, userId: string): Promise<UserView> {
		await this.getOwned(baseId, userId);
		const user = await this.prisma.baseUser.update({where: {id: userId}, data: {keyHash: null}, include: withInstances});
		this.logger.info("Personal key revoked", {baseId, userId});
		return toUserView(user);
	}

	async remove(baseId: string, userId: string): Promise<UserView> {
		const user = await this.getOwned(baseId, userId);
		await this.prisma.baseUser.delete({where: {id: userId}});
		return toUserView(user);
	}

	private async getOwned(baseId: string, userId: string): Promise<UserWithInstances> {
		const user = await this.prisma.baseUser.findUnique({where: {id: userId}, include: withInstances});
		if (!user || user.baseId !== baseId) {
			throw apiError(ErrorCode.USER_NOT_FOUND, "User not found in this base", 404);
		}
		return user;
	}
}
