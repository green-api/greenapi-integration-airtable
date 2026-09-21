import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { CreateAutomationKeyDto } from "./dto/create-automation-key.dto";
import { PersonalKeyGuard } from "../bases/guards/base-key.guard";
import { AdminGuard } from "../bases/guards/admin.guard";
import { AuthReq } from "../types";

@Controller("automation-keys")
@UseGuards(PersonalKeyGuard, AdminGuard)
export class AutomationKeysController {
	constructor(private readonly automation: AutomationService) {}

	@Get()
	list(@Req() req: AuthReq) {
		return this.automation.list(req.base.id);
	}

	@Post()
	create(@Req() req: AuthReq, @Body() dto: CreateAutomationKeyDto) {
		return this.automation.create(req.base.id, dto);
	}

	@Delete(":id")
	revoke(@Req() req: AuthReq, @Param("id") id: string) {
		return this.automation.revoke(req.base.id, id);
	}
}
