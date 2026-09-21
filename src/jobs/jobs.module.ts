import { Module } from "@nestjs/common";
import { AirtableModule } from "../airtable/airtable.module";
import { BaseKeyModule } from "../bases/base-key.module";
import { InstancesModule } from "../instances/instances.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { JobsRunner } from "./jobs.runner";

@Module({
	imports: [AirtableModule, BaseKeyModule, InstancesModule],
	controllers: [JobsController],
	providers: [JobsService, JobsRunner],
	exports: [JobsService],
})
export class JobsModule {}
