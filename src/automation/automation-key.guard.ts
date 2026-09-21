import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationService } from "./automation.service";
import { AutomationReq } from "../types";
import { apiError, ErrorCode } from "../errors";

@Injectable()
export class AutomationKeyGuard implements CanActivate {
	constructor(
		private readonly prisma: PrismaService,
		private readonly automation: AutomationService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AutomationReq>();
		const [scheme, key] = (request.headers.authorization ?? "").split(" ");
		if (scheme !== "Bearer" || !key) {
			throw apiError(ErrorCode.AUTOMATION_KEY_INVALID, "Missing automation key", 401);
		}
		const automationKey = await this.automation.findByKey(key);
		if (!automationKey) {
			throw apiError(ErrorCode.AUTOMATION_KEY_INVALID, "Unknown or revoked automation key", 401);
		}
		const base = await this.prisma.findUser(automationKey.baseId);
		if (!base) {
			throw apiError(ErrorCode.AUTOMATION_KEY_INVALID, "Base no longer exists", 401);
		}
		await this.automation.touch(automationKey.id);
		request.base = base;
		request.automationKey = automationKey;
		return true;
	}
}
