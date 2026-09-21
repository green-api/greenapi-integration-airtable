import { Module } from "@nestjs/common";
import { AirtableModule } from "../airtable/airtable.module";
import { BaseKeyModule } from "../bases/base-key.module";
import { InstancesController } from "./instances.controller";
import { InstancesService } from "./instances.service";

@Module({
	imports: [AirtableModule, BaseKeyModule],
	controllers: [InstancesController],
	providers: [InstancesService],
	exports: [InstancesService],
})
export class InstancesModule {}
