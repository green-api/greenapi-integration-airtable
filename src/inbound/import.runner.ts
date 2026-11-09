import { Injectable, OnModuleInit } from "@nestjs/common";
import { setTimeout as sleep } from "node:timers/promises";
import { GreenApiLogger, IntegrationError } from "@green-api/greenapi-integration";
import { ImportJob } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InboundService } from "./inbound.service";
import { ErrorCode } from "../errors";
import { redactSecrets } from "../redact";
import {
	AIRTABLE_RATE_LIMIT_BACKOFF_MS,
	ERROR_MAX_LENGTH,
	GREEN_API_RATE_LIMIT_RETRY_MS,
	IMPORT_CHUNK_SIZE,
	IMPORT_RATE_LIMIT_RETRIES,
} from "../defaults";

@Injectable()
export class ImportRunner implements OnModuleInit {
	private readonly logger = GreenApiLogger.getInstance(ImportRunner.name);
	private readonly workers = new Map<bigint, Promise<void>>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly inbound: InboundService,
	) {}

	async onModuleInit() {
		const pending = await this.prisma.importJob.findMany({
			where: {status: {in: ["queued", "running"]}},
			distinct: ["idInstance"],
			select: {idInstance: true},
		});
		for (const {idInstance} of pending) {
			this.kick(idInstance);
		}
	}

	kick(idInstance: bigint): void {
		if (this.workers.has(idInstance)) {
			return;
		}
		const worker = this.drain(idInstance)
			.catch(error => this.logger.error("Import worker crashed", {idInstance: Number(idInstance), error}))
			.finally(() => this.workers.delete(idInstance));
		this.workers.set(idInstance, worker);
	}

	private async drain(idInstance: bigint): Promise<void> {
		for (;;) {
			const job = await this.prisma.importJob.findFirst({
				where: {idInstance, status: {in: ["queued", "running"]}},
				orderBy: {createdAt: "asc"},
			});
			if (!job) {
				return;
			}
			await this.run(job);
		}
	}

	private async run(job: ImportJob): Promise<void> {
		const instance = await this.prisma.getInstance(job.idInstance);
		if (!instance) {
			return;
		}
		await this.prisma.importJob.update({
			where: {id: job.id},
			data: {status: "running", startedAt: new Date(), total: null, imported: 0, skipped: 0, error: null},
		});
		try {
			const target = await this.inbound.targetFor(instance);
			const items = (await this.withRetry(() => this.inbound.fetchHistory(instance, job.minutes))).sort((a, b) => a.timestamp - b.timestamp);
			await this.prisma.importJob.update({where: {id: job.id}, data: {total: items.length}});
			for (let i = 0; i < items.length; i += IMPORT_CHUNK_SIZE) {
				const chunk = items.slice(i, i + IMPORT_CHUNK_SIZE);
				const result = await this.withRetry(() => this.inbound.importItems(target, chunk));
				await this.prisma.importJob.update({
					where: {id: job.id},
					data: {imported: {increment: result.imported}, skipped: {increment: result.skipped}},
				});
			}
			await this.prisma.importJob.updateMany({where: {id: job.id}, data: {status: "done", finishedAt: new Date()}});
			this.logger.info("History imported", {baseId: job.baseId, idInstance: Number(job.idInstance), minutes: job.minutes, total: items.length});
		} catch (error) {
			const message = redactSecrets(error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX_LENGTH);
			this.logger.warn("History import failed", {baseId: job.baseId, idInstance: Number(job.idInstance), error: message});
			await this.prisma.importJob.updateMany({where: {id: job.id}, data: {status: "failed", error: message, finishedAt: new Date()}});
		}
	}

	private async withRetry<T>(action: () => Promise<T>): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			try {
				return await action();
			} catch (error) {
				const delay = retryDelay(error);
				if (delay === null || attempt >= IMPORT_RATE_LIMIT_RETRIES) {
					throw error;
				}
				this.logger.info("Rate limited during import, retrying", {code: (error as IntegrationError).code, delayMs: delay, attempt: attempt + 1});
				await sleep(delay);
			}
		}
	}
}

function retryDelay(error: unknown): number | null {
	if (!(error instanceof IntegrationError)) {
		return null;
	}
	if (error.code === ErrorCode.AIRTABLE_RATE_LIMITED) {
		return AIRTABLE_RATE_LIMIT_BACKOFF_MS;
	}
	if (error.code === ErrorCode.GREEN_API_RATE_LIMITED) {
		return GREEN_API_RATE_LIMIT_RETRY_MS;
	}
	return null;
}
