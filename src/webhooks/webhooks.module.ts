import { Module } from "@nestjs/common";
import { InboundModule } from "../inbound/inbound.module";
import { WebhooksController } from "./webhooks.controller";
import { GreenApiWebhookGuard } from "./guards/greenapi-webhook.guard";

@Module({
	imports: [InboundModule],
	controllers: [WebhooksController],
	providers: [GreenApiWebhookGuard],
})
export class WebhooksModule {}
