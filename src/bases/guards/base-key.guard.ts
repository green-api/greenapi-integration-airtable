import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../../users/users.service";
import { RoleService } from "../../airtable-api/role.service";
import { AuthReq } from "../../types";
import { apiError, ErrorCode } from "../../errors";

@Injectable()
export class PersonalKeyGuard implements CanActivate {
	constructor(
		private readonly prisma: PrismaService,
		private readonly users: UsersService,
		private readonly roles: RoleService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthReq>();
		const header = request.headers.authorization ?? "";
		const [scheme, key] = header.split(" ");
		if (scheme !== "Bearer" || !key) {
			throw apiError(ErrorCode.KEY_INVALID, "Missing personal key", 401);
		}
		const found = await this.users.findByKey(key);
		if (!found) {
			throw apiError(ErrorCode.KEY_INVALID, "Unknown or revoked personal key", 401);
		}
		const user = await this.roles.current(found);
		const base = await this.prisma.findUser(user.baseId);
		if (!base) {
			throw apiError(ErrorCode.KEY_INVALID, "Base no longer exists", 401);
		}
		await this.users.touch(user.id);
		request.base = base;
		request.user = user;
		return true;
	}
}
