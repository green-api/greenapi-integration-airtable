import { Module } from "@nestjs/common";
import { AirtableApiModule } from "../airtable-api/airtable-api.module";
import { BaseKeyModule } from "../bases/base-key.module";
import { UsersModule } from "../users/users.module";
import { OauthController } from "./oauth.controller";

@Module({
	imports: [AirtableApiModule, BaseKeyModule, UsersModule],
	controllers: [OauthController],
})
export class OauthModule {}
