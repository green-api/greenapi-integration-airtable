import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { InstancesService } from "./instances.service";
import { CreateInstanceDto } from "./dto/create-instance.dto";
import { SetReceiveDto } from "./dto/set-receive.dto";
import { PersonalKeyGuard } from "../bases/guards/base-key.guard";
import { AdminGuard } from "../bases/guards/admin.guard";
import { AuthReq } from "../types";

@Controller("instances")
@UseGuards(PersonalKeyGuard)
export class InstancesController {
	constructor(private readonly instances: InstancesService) {}

	@Get()
	list(@Req() req: AuthReq) {
		return this.instances.list(req.base.id);
	}

	@Post()
	@UseGuards(AdminGuard)
	add(@Req() req: AuthReq, @Body() dto: CreateInstanceDto) {
		return this.instances.add(req.base.id, dto);
	}

	@Patch(":idInstance/receive")
	@UseGuards(AdminGuard)
	setReceive(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number, @Body() dto: SetReceiveDto) {
		return this.instances.setReceive(req.base.id, idInstance, dto.receive);
	}

	@Delete(":idInstance")
	@UseGuards(AdminGuard)
	remove(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number) {
		return this.instances.remove(req.base.id, idInstance);
	}
}
