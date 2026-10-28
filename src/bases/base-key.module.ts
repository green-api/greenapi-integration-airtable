import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { AirtableApiModule } from "../airtable-api/airtable-api.module";
import { PersonalKeyGuard } from "./guards/base-key.guard";
import { AdminGuard } from "./guards/admin.guard";

@Module({
	imports: [UsersModule, AirtableApiModule],
	providers: [PersonalKeyGuard, AdminGuard],
	exports: [PersonalKeyGuard, AdminGuard, UsersModule, AirtableApiModule],
})
export class BaseKeyModule {}
