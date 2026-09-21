import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { AutomationKeyGuard } from "./automation-key.guard";
import { AutomationSendDto } from "./dto/automation-send.dto";
import { AutomationReq } from "../types";

@Controller("send")
@UseGuards(AutomationKeyGuard)
export class AutomationSendController {
	constructor(private readonly automation: AutomationService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	send(@Req() req: AutomationReq, @Body() dto: AutomationSendDto) {
		return this.automation.send(req.base, req.automationKey, dto);
	}
}
