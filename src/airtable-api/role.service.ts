import { Injectable } from "@nestjs/common";
import { GreenApiLogger } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { AirtableAuthService } from "./airtable-auth.service";
import { apiError, ErrorCode } from "../errors";
import { ROLE_RECHECK_INTERVAL_MS, ROLE_RECHECK_RETRY_MS, SENDER_PERMISSION_LEVELS } from "../defaults";
import { UserWithInstances } from "../types";

@Injectable()
export class RoleService {
	private readonly logger = GreenApiLogger.getInstance(RoleService.name);
	private readonly retryAfter = new Map<string, number>();
	private readonly checking = new Map<string, Promise<UserWithInstances>>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly auth: AirtableAuthService,
	) {}

	current(user: UserWithInstances): Promise<UserWithInstances> {
		if (user.roleCheckedAt && Date.now() - user.roleCheckedAt.getTime() < ROLE_RECHECK_INTERVAL_MS) {
			return Promise.resolve(user);
		}
		if ((this.retryAfter.get(user.id) ?? 0) > Date.now()) {
			return Promise.resolve(user);
		}
		const inFlight = this.checking.get(user.id);
		if (inFlight) {
			return inFlight;
		}
		const task = this.check(user).finally(() => this.checking.delete(user.id));
		this.checking.set(user.id, task);
		return task;
	}

	private async check(user: UserWithInstances): Promise<UserWithInstances> {
		const permission = await this.auth.currentPermission(user);
		if (permission === "unknown") {
			this.retryAfter.set(user.id, Date.now() + ROLE_RECHECK_RETRY_MS);
			this.logger.warn("Role check postponed, Airtable did not answer", {baseId: user.baseId, userId: user.id});
			return user;
		}
		this.retryAfter.delete(user.id);
		if (permission === "lost" || !(SENDER_PERMISSION_LEVELS as readonly string[]).includes(permission)) {
			await this.prisma.$transaction([
				this.prisma.userAuth.deleteMany({where: {userId: user.id}}),
				this.prisma.baseUser.update({where: {id: user.id}, data: {keyHash: null, roleCheckedAt: new Date()}}),
			]);
			this.logger.info("Personal key revoked, Airtable access changed", {baseId: user.baseId, userId: user.id, permission});
			throw apiError(ErrorCode.KEY_INVALID, "Your access to this Airtable base changed. Confirm your identity again.", 401);
		}
		const updated = await this.prisma.baseUser.update({
			where: {id: user.id},
			data: {permissionLevel: permission, roleCheckedAt: new Date()},
			include: {instances: true},
		});
		if (updated.permissionLevel !== user.permissionLevel) {
			this.logger.info("Role updated from Airtable", {baseId: user.baseId, userId: user.id, from: user.permissionLevel, to: updated.permissionLevel});
		}
		return updated;
	}
}
