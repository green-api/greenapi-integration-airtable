import { ADMIN_PERMISSION_LEVELS } from "../defaults";
import { apiError, ErrorCode } from "../errors";
import { UserWithInstances } from "../types";

function allowedInstances(user: UserWithInstances): number[] {
	return user.instances.map(link => Number(link.idInstance));
}

export function assertCanSend(user: UserWithInstances, idInstance: number): void {
	if ((ADMIN_PERMISSION_LEVELS as readonly string[]).includes(user.permissionLevel)) {
		return;
	}
	const allowed = allowedInstances(user);
	if (allowed.length === 0) {
		throw apiError(ErrorCode.INSTANCE_NOT_ASSIGNED, "No instance is assigned to you; ask a base owner", 403);
	}
	if (!allowed.includes(idInstance)) {
		throw apiError(ErrorCode.INSTANCE_FORBIDDEN, "You may only send with the instances assigned to you", 403);
	}
}
