import { Injectable } from "@nestjs/common";
import { AirtableApiService, AirtableTable } from "../airtable-api/airtable-api.service";
import { SCHEMA_CACHE_TTL_MS } from "../defaults";

interface CacheEntry {
	tables: AirtableTable[];
	expiresAt: number;
}

@Injectable()
export class SchemaCache {
	private readonly cache = new Map<string, CacheEntry>();

	constructor(private readonly api: AirtableApiService) {}

	async tables(baseId: string, fresh = false): Promise<AirtableTable[]> {
		const cached = this.cache.get(baseId);
		if (!fresh && cached && cached.expiresAt > Date.now()) {
			return cached.tables;
		}
		const tables = await this.api.listTables(baseId);
		this.cache.set(baseId, {tables, expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS});
		return tables;
	}

	async fieldName(baseId: string, tableId: string, fieldId: string): Promise<string | null> {
		const find = (tables: AirtableTable[]) => tables.find(t => t.id === tableId)?.fields.find(f => f.id === fieldId)?.name ?? null;
		return find(await this.tables(baseId)) ?? find(await this.tables(baseId, true));
	}

	invalidate(baseId: string): void {
		this.cache.delete(baseId);
	}
}
