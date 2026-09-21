import { Module } from "@nestjs/common";
import { BaseKeyModule } from "../bases/base-key.module";
import { InstancesModule } from "../instances/instances.module";
import { JobsModule } from "../jobs/jobs.module";
import { AutomationService } from "./automation.service";
import { AutomationKeyGuard } from "./automation-key.guard";
import { AutomationKeysController } from "./automation-keys.controller";
import { AutomationSendController } from "./automation-send.controller";

@Module({
	imports: [BaseKeyModule, InstancesModule, JobsModule],
	controllers: [AutomationKeysController, AutomationSendController],
	providers: [AutomationService, AutomationKeyGuard],
})
export class AutomationModule {}
