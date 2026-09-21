import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { GreenApiWebhook } from "@green-api/greenapi-integration";
import { InboundService } from "../inbound/inbound.service";
import { GreenApiWebhookGuard } from "./guards/greenapi-webhook.guard";

@Controller("webhooks")
@SkipThrottle()
export class WebhooksController {
	constructor(private readonly inbound: InboundService) {}

	@Post("green-api")
	@HttpCode(HttpStatus.OK)
	@UseGuards(GreenApiWebhookGuard)
	async greenApi(@Body() webhook: GreenApiWebhook) {
		await this.inbound.ingest(webhook);
		return {ok: true};
	}
}
