import { Module } from "@nestjs/common";
import { AirtableAdapter } from "./airtable.adapter";
import { AirtableTransformer } from "./airtable.transformer";

@Module({
	providers: [AirtableTransformer, AirtableAdapter],
	exports: [AirtableAdapter],
})
export class AirtableModule {}
