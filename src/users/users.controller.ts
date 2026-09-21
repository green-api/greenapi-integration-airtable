import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { UsersService, toUserView } from "./users.service";
import { SetInstancesDto } from "./dto/assign-instance.dto";
import { PersonalKeyGuard } from "../bases/guards/base-key.guard";
import { AdminGuard } from "../bases/guards/admin.guard";
import { AuthReq } from "../types";

@Controller("users")
@UseGuards(PersonalKeyGuard)
export class UsersController {
	constructor(private readonly users: UsersService) {}

	@Get("me")
	me(@Req() req: AuthReq) {
		return toUserView(req.user);
	}

	@Get()
	@UseGuards(AdminGuard)
	list(@Req() req: AuthReq) {
		return this.users.list(req.base.id);
	}

	@Put(":id/instances")
	@UseGuards(AdminGuard)
	setInstances(@Req() req: AuthReq, @Param("id") id: string, @Body() dto: SetInstancesDto) {
		return this.users.setInstances(req.base.id, id, dto.idInstances);
	}

	@Post(":id/revoke")
	@UseGuards(AdminGuard)
	revoke(@Req() req: AuthReq, @Param("id") id: string) {
		return this.users.revoke(req.base.id, id);
	}

	@Delete(":id")
	@UseGuards(AdminGuard)
	remove(@Req() req: AuthReq, @Param("id") id: string) {
		return this.users.remove(req.base.id, id);
	}
}
