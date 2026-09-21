import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AirtableModule } from "./airtable/airtable.module";
import { BasesModule } from "./bases/bases.module";
import { InstancesModule } from "./instances/instances.module";
import { JobsModule } from "./jobs/jobs.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { OauthModule } from "./oauth/oauth.module";
import { InboundModule } from "./inbound/inbound.module";
import { AirtableApiModule } from "./airtable-api/airtable-api.module";
import { UsersApiModule } from "./users/users-api.module";
import { AutomationModule } from "./automation/automation.module";
import { ToolsModule } from "./tools/tools.module";
import { THROTTLE_LIMIT, THROTTLE_TTL_MS } from "./defaults";

@Module({
	imports: [
		ConfigModule.forRoot({isGlobal: true, envFilePath: ".env"}),
		ThrottlerModule.forRoot([{ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT}]),
		PrismaModule,
		AirtableModule,
		BasesModule,
		InstancesModule,
		JobsModule,
		WebhooksModule,
		OauthModule,
		InboundModule,
		AirtableApiModule,
		UsersApiModule,
		AutomationModule,
		ToolsModule,
	],
	providers: [{provide: APP_GUARD, useClass: ThrottlerGuard}],
})
export class AppModule {}
