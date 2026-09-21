import { Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";
import { GreenApiLogger } from "@green-api/greenapi-integration";
import { AirtableAuthService } from "./airtable-auth.service";
import { apiError, ErrorCode } from "../errors";
import {
	AIRTABLE_API_URL,
	AIRTABLE_FIND_DEFAULT_MAX,
	AIRTABLE_RATE_LIMIT_BACKOFF_MS,
	AIRTABLE_RATE_LIMIT_PER_SECOND,
	AIRTABLE_WRITE_BATCH,
} from "../defaults";

export type Fields = Record<string, unknown>;

export interface AirtableRecord {
	id: string;
	createdTime: string;
	fields: Fields;
}

export interface AirtableField {
	id: string;
	name: string;
	type: string;
	options?: Record<string, unknown>;
}

export interface AirtableTable {
	id: string;
	name: string;
	primaryFieldId: string;
	fields: AirtableField[];
}

class RateLimiter {
	private stamps: number[] = [];

	constructor(private readonly perSecond: number) {}

	async acquire(): Promise<void> {
		for (;;) {
			const now = Date.now();
			this.stamps = this.stamps.filter(stamp => now - stamp < 1000);
			if (this.stamps.length < this.perSecond) {
				this.stamps.push(now);
				return;
			}
			await sleep(1000 - (now - this.stamps[0]) + 5);
		}
	}
}

@Injectable()
export class AirtableApiService {
	private readonly logger = GreenApiLogger.getInstance(AirtableApiService.name);
	private readonly limiters = new Map<string, RateLimiter>();

	constructor(private readonly auth: AirtableAuthService) {}

	async listTables(baseId: string): Promise<AirtableTable[]> {
		const data = await this.request<{ tables: AirtableTable[] }>(baseId, "GET", `/meta/bases/${baseId}/tables`);
		return data.tables;
	}

	async createRecords(baseId: string, tableId: string, records: Fields[]): Promise<AirtableRecord[]> {
		const created: AirtableRecord[] = [];
		for (let i = 0; i < records.length; i += AIRTABLE_WRITE_BATCH) {
			const batch = records.slice(i, i + AIRTABLE_WRITE_BATCH).map(fields => ({fields}));
			const data = await this.request<{ records: AirtableRecord[] }>(baseId, "POST", `/${baseId}/${tableId}`, {
				records: batch,
				typecast: true,
				returnFieldsByFieldId: true,
			});
			created.push(...data.records);
		}
		return created;
	}

	async updateRecords(baseId: string, tableId: string, records: Array<{ id: string; fields: Fields }>): Promise<void> {
		for (let i = 0; i < records.length; i += AIRTABLE_WRITE_BATCH) {
			await this.request(baseId, "PATCH", `/${baseId}/${tableId}`, {
				records: records.slice(i, i + AIRTABLE_WRITE_BATCH),
				typecast: true,
				returnFieldsByFieldId: true,
			});
		}
	}

	async findRecords(baseId: string, tableId: string, filterByFormula: string, fields: string[] = [], maxRecords = AIRTABLE_FIND_DEFAULT_MAX): Promise<AirtableRecord[]> {
		const params = new URLSearchParams({filterByFormula, maxRecords: String(maxRecords), returnFieldsByFieldId: "true"});
		for (const field of fields) {
			params.append("fields[]", field);
		}
		const data = await this.request<{ records: AirtableRecord[] }>(baseId, "GET", `/${baseId}/${tableId}?${params.toString()}`);
		return data.records;
	}

	private async request<T>(baseId: string, method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
		const token = await this.auth.getAccessToken(baseId);
		await this.limiter(baseId).acquire();
		try {
			const response = await axios.request<T>({
				method,
				url: `${AIRTABLE_API_URL}${path}`,
				data: body,
				headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
			});
			return response.data;
		} catch (error) {
			throw this.translate(error as AxiosError<{ error?: { type?: string; message?: string } | string }>, path);
		}
	}

	private translate(error: AxiosError<{ error?: { type?: string; message?: string } | string }>, path: string) {
		const status = error.response?.status ?? 0;
		const payload = error.response?.data?.error;
		const message = typeof payload === "string" ? payload : payload?.message ?? error.message;
		this.logger.warn("Airtable API error", {status, path, message});
		if (status === 429) {
			return apiError(ErrorCode.AIRTABLE_RATE_LIMITED, "Airtable rate limit hit", 429, {retryAfterMs: AIRTABLE_RATE_LIMIT_BACKOFF_MS});
		}
		if (status === 401) {
			return apiError(ErrorCode.AIRTABLE_TOKEN_EXPIRED, "Airtable rejected the access token", 401);
		}
		if (status === 403 || status === 404) {
			return apiError(ErrorCode.AIRTABLE_BASE_FORBIDDEN, `Airtable denied access: ${message}`, 403);
		}
		return apiError(ErrorCode.AIRTABLE_API_ERROR, `Airtable API error (${status}): ${message}`, 502);
	}

	private limiter(baseId: string): RateLimiter {
		let limiter = this.limiters.get(baseId);
		if (!limiter) {
			limiter = new RateLimiter(AIRTABLE_RATE_LIMIT_PER_SECOND);
			this.limiters.set(baseId, limiter);
		}
		return limiter;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
