import { Body, Controller, Delete, Get, Put, Req, UseGuards } from "@nestjs/common";
import { BasesService } from "./bases.service";
import { InboundConfigDto } from "./dto/inbound-config.dto";
import { AdminGuard } from "./guards/admin.guard";
import { PersonalKeyGuard } from "./guards/base-key.guard";
import { AuthReq } from "../types";

@Controller("bases")
@UseGuards(PersonalKeyGuard)
export class BasesController {
	constructor(private readonly bases: BasesService) {}

	@Get("me")
	me(@Req() req: AuthReq) {
		return this.bases.view(req.base, req.user);
	}

	@Put("inbound")
	@UseGuards(AdminGuard)
	setInbound(@Req() req: AuthReq, @Body() dto: InboundConfigDto) {
		return this.bases.setInbound(req.base.id, dto);
	}

	@Delete("inbound")
	@UseGuards(AdminGuard)
	clearInbound(@Req() req: AuthReq) {
		return this.bases.setInbound(req.base.id, null);
	}

	@Delete("airtable")
	@UseGuards(AdminGuard)
	disconnectAirtable(@Req() req: AuthReq) {
		return this.bases.disconnectAirtable(req.base.id);
	}
}
