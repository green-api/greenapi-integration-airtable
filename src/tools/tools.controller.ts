import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ToolsService } from "./tools.service";
import { InstancesService } from "../instances/instances.service";
import { CheckNumbersDto, ImportChatDto, ImportHistoryDto } from "./dto/tools.dto";
import { PersonalKeyGuard } from "../bases/guards/base-key.guard";
import { AdminGuard } from "../bases/guards/admin.guard";
import { assertCanSend } from "../jobs/authorize";
import { AuthReq } from "../types";

@Controller("instances/:idInstance")
@UseGuards(PersonalKeyGuard)
export class ToolsController {
	constructor(
		private readonly tools: ToolsService,
		private readonly instances: InstancesService,
	) {}

	@Post("check")
	async check(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number, @Body() dto: CheckNumbersDto) {
		assertCanSend(req.user, idInstance);
		return this.tools.checkNumbers(await this.instances.getOwned(req.base.id, idInstance), dto.phones);
	}

	@Post("history")
	async history(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number, @Body() dto: ImportHistoryDto) {
		assertCanSend(req.user, idInstance);
		return this.tools.importHistory(await this.instances.getOwned(req.base.id, idInstance), dto.minutes);
	}

	@Post("chat-history")
	async chatHistory(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number, @Body() dto: ImportChatDto) {
		assertCanSend(req.user, idInstance);
		return this.tools.importChat(await this.instances.getOwned(req.base.id, idInstance), dto.chatId, dto.count);
	}

	@Get("qr")
	@UseGuards(AdminGuard)
	async qr(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number) {
		return this.tools.qr(await this.instances.getOwned(req.base.id, idInstance));
	}

	@Get("queue")
	async queue(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number) {
		assertCanSend(req.user, idInstance);
		return this.tools.queue(await this.instances.getOwned(req.base.id, idInstance));
	}

	@Post("queue/clear")
	@UseGuards(AdminGuard)
	async clearQueue(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number) {
		return this.tools.clearQueue(await this.instances.getOwned(req.base.id, idInstance));
	}

	@Get("contacts")
	@UseGuards(AdminGuard)
	async contacts(@Req() req: AuthReq, @Param("idInstance", ParseIntPipe) idInstance: number) {
		return this.tools.contacts(await this.instances.getOwned(req.base.id, idInstance));
	}
}
