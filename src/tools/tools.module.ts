import { Module } from "@nestjs/common";
import { AirtableModule } from "../airtable/airtable.module";
import { BaseKeyModule } from "../bases/base-key.module";
import { InboundModule } from "../inbound/inbound.module";
import { InstancesModule } from "../instances/instances.module";
import { ToolsController } from "./tools.controller";
import { ToolsService } from "./tools.service";

@Module({
	imports: [AirtableModule, BaseKeyModule, InboundModule, InstancesModule],
	controllers: [ToolsController],
	providers: [ToolsService],
})
export class ToolsModule {}
