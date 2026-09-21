import { Module } from "@nestjs/common";
import { AirtableAuthService } from "./airtable-auth.service";
import { AirtableApiService } from "./airtable-api.service";

@Module({
	providers: [AirtableAuthService, AirtableApiService],
	exports: [AirtableAuthService, AirtableApiService],
})
export class AirtableApiModule {}
