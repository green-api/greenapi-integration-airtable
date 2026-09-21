import { Module } from "@nestjs/common";
import { AirtableModule } from "../airtable/airtable.module";
import { AirtableApiModule } from "../airtable-api/airtable-api.module";
import { InboundService } from "./inbound.service";
import { ContactResolver } from "./contact-resolver";
import { MessageIndex } from "./message-index";
import { SchemaCache } from "./schema-cache";

@Module({
	imports: [AirtableModule, AirtableApiModule],
	providers: [InboundService, ContactResolver, MessageIndex, SchemaCache],
	exports: [InboundService, SchemaCache],
})
export class InboundModule {}
