import { Module } from "@nestjs/common";
import { AirtableAuthService } from "./airtable-auth.service";
import { AirtableApiService } from "./airtable-api.service";
import { RoleService } from "./role.service";

@Module({
	providers: [AirtableAuthService, AirtableApiService, RoleService],
	exports: [AirtableAuthService, AirtableApiService, RoleService],
})
export class AirtableApiModule {}
