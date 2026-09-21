import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthReq } from "../../types";
import { apiError, ErrorCode } from "../../errors";
import { ADMIN_PERMISSION_LEVELS } from "../../defaults";

@Injectable()
export class AdminGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const {user} = context.switchToHttp().getRequest<AuthReq>();
		if (!(ADMIN_PERMISSION_LEVELS as readonly string[]).includes(user.permissionLevel)) {
			throw apiError(ErrorCode.USER_NOT_ADMIN, "Only base owners and creators can change this", 403);
		}
		return true;
	}
}
