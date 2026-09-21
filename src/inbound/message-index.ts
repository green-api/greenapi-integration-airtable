import { Injectable } from "@nestjs/common";
import { AirtableApiService } from "../airtable-api/airtable-api.service";
import { equalsAny } from "../airtable-api/formula";
import { SchemaCache } from "./schema-cache";
import { MESSAGE_ID_LOOKUP_CHUNK } from "../defaults";
import { apiError, ErrorCode } from "../errors";
import { InboundConfig } from "../types";

@Injectable()
export class MessageIndex {
	constructor(
		private readonly api: AirtableApiService,
		private readonly schema: SchemaCache,
	) {}

	async find(baseId: string, config: InboundConfig, idMessage: string): Promise<string | null> {
		const field = await this.fieldName(baseId, config);
		const records = await this.api.findRecords(baseId, config.tableId, equalsAny(field, [idMessage]), [config.fields.idMessage], 1);
		return records[0]?.id ?? null;
	}

	async known(baseId: string, config: InboundConfig, idMessages: string[]): Promise<Set<string>> {
		const field = await this.fieldName(baseId, config);
		const ids = [...new Set(idMessages.filter(Boolean))];
		const known = new Set<string>();
		for (let i = 0; i < ids.length; i += MESSAGE_ID_LOOKUP_CHUNK) {
			const chunk = ids.slice(i, i + MESSAGE_ID_LOOKUP_CHUNK);
			const records = await this.api.findRecords(baseId, config.tableId, equalsAny(field, chunk), [config.fields.idMessage], chunk.length);
			for (const record of records) {
				const value = record.fields[config.fields.idMessage];
				if (typeof value === "string") {
					known.add(value);
				}
			}
		}
		return known;
	}

	private async fieldName(baseId: string, config: InboundConfig): Promise<string> {
		const name = await this.schema.fieldName(baseId, config.tableId, config.fields.idMessage);
		if (!name) {
			throw apiError(ErrorCode.INBOUND_NOT_CONFIGURED, "The Message ID column of the messages table no longer exists; map it again in Settings → Receiving", 409);
		}
		return name;
	}
}
