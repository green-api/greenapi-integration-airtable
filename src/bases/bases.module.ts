import { Module } from "@nestjs/common";
import { AirtableModule } from "../airtable/airtable.module";
import { AirtableApiModule } from "../airtable-api/airtable-api.module";
import { InboundModule } from "../inbound/inbound.module";
import { InstancesModule } from "../instances/instances.module";
import { BaseKeyModule } from "./base-key.module";
import { BasesController } from "./bases.controller";
import { BasesService } from "./bases.service";

@Module({
	imports: [AirtableModule, AirtableApiModule, InboundModule, InstancesModule, BaseKeyModule],
	controllers: [BasesController],
	providers: [BasesService],
})
export class BasesModule {}
