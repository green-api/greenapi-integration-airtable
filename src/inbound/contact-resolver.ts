import { Injectable } from "@nestjs/common";
import { GreenApiLogger } from "@green-api/greenapi-integration";
import { AirtableApiService } from "../airtable-api/airtable-api.service";
import { digitsEqual } from "../airtable-api/formula";
import { SchemaCache } from "./schema-cache";
import { CONTACT_CACHE_TTL_MS, NUMERIC_CHAT_ID, PHONE_CHAT_ID } from "../defaults";
import { InboundConfig } from "../types";

interface CacheEntry {
	recordId: string | null;
	expiresAt: number;
}

@Injectable()
export class ContactResolver {
	private readonly logger = GreenApiLogger.getInstance(ContactResolver.name);
	private readonly cache = new Map<string, CacheEntry>();

	constructor(
		private readonly api: AirtableApiService,
		private readonly schema: SchemaCache,
	) {}

	async resolve(baseId: string, config: InboundConfig, chatId: string, senderPhone?: number): Promise<string | null> {
		const link = config.contactLink;
		if (!link || !config.fields.contact) {
			return null;
		}
		const phoneMatch = PHONE_CHAT_ID.exec(chatId);
		if (phoneMatch) {
			return this.cached(`${baseId}:${link.tableId}:phone:${phoneMatch[1]}`, () => this.lookup(baseId, link.tableId, link.phoneFieldId, phoneMatch[1]));
		}
		if (!NUMERIC_CHAT_ID.test(chatId)) {
			return null;
		}
		const byChatId = link.chatIdFieldId
			? await this.cached(`${baseId}:${link.tableId}:chat:${chatId}`, () => this.lookup(baseId, link.tableId, link.chatIdFieldId as string, chatId))
			: null;
		if (byChatId || !senderPhone) {
			return byChatId;
		}
		const digits = String(senderPhone);
		return this.cached(`${baseId}:${link.tableId}:phone:${digits}`, () => this.lookup(baseId, link.tableId, link.phoneFieldId, digits));
	}

	private async cached(key: string, load: () => Promise<string | null>): Promise<string | null> {
		const hit = this.cache.get(key);
		if (hit && hit.expiresAt > Date.now()) {
			return hit.recordId;
		}
		const recordId = await load();
		this.cache.set(key, {recordId, expiresAt: Date.now() + CONTACT_CACHE_TTL_MS});
		return recordId;
	}

	private async lookup(baseId: string, tableId: string, fieldId: string, digits: string): Promise<string | null> {
		try {
			const fieldName = await this.schema.fieldName(baseId, tableId, fieldId);
			if (!fieldName) {
				return null;
			}
			const records = await this.api.findRecords(baseId, tableId, digitsEqual(fieldName, digits), [fieldId]);
			return records[0]?.id ?? null;
		} catch (error) {
			this.logger.warn("Contact lookup failed", {baseId, tableId, error: (error as Error).message});
			return null;
		}
	}
}
