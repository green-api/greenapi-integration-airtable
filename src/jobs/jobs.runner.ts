import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma, SendJob, SendJobItem } from "../generated/prisma/client";
import { GreenApiClient, GreenApiLogger, SendResponse } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { AirtableAdapter } from "../airtable/airtable.adapter";
import { OutboundPayload } from "../types";
import { ErrorCode } from "../errors";
import { redactSecrets } from "../redact";
import { downloadPublicUrl } from "./download";
import { ERROR_MAX_LENGTH, FILE_URL_TTL_MS } from "../defaults";

@Injectable()
export class JobsRunner implements OnModuleInit {
	private readonly logger = GreenApiLogger.getInstance(JobsRunner.name);
	private readonly workers = new Map<bigint, Promise<void>>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly adapter: AirtableAdapter,
	) {}

	async onModuleInit() {
		const pending = await this.prisma.sendJob.findMany({
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
			.catch(error => this.logger.error("Worker crashed", {idInstance: Number(idInstance), error}))
			.finally(() => this.workers.delete(idInstance));
		this.workers.set(idInstance, worker);
	}

	private async drain(idInstance: bigint): Promise<void> {
		for (;;) {
			const job = await this.prisma.sendJob.findFirst({
				where: {idInstance, status: {in: ["queued", "running"]}},
				orderBy: {createdAt: "asc"},
			});
			if (!job) {
				return;
			}
			await this.run(job);
		}
	}

	private async run(job: SendJob): Promise<void> {
		const instance = await this.prisma.getInstance(job.idInstance);
		if (!instance) {
			return;
		}
		await this.prisma.sendJob.update({where: {id: job.id}, data: {status: "running", startedAt: job.startedAt ?? new Date()}});
		const client = this.adapter.createGreenApiClient(instance);

		if (!(await this.isAuthorized(client))) {
			await this.failRemaining(job.id, ErrorCode.INSTANCE_NOT_AUTHORIZED);
			await this.finish(job.id);
			return;
		}

		const items = await this.prisma.sendJobItem.findMany({
			where: {jobId: job.id, status: "queued"},
			orderBy: {position: "asc"},
		});

		for (const item of items) {
			if (await this.isCancelled(job.id)) {
				return;
			}
			if (item.payload?.type === "file" && Date.now() - job.createdAt.getTime() > FILE_URL_TTL_MS) {
				await this.markFailed(item, ErrorCode.FILE_URL_EXPIRED);
				continue;
			}
			await this.sendItem(job, item, client);
		}
		await this.finish(job.id);
	}

	private async sendItem(job: SendJob, item: SendJobItem, client: GreenApiClient): Promise<void> {
		if (!item.payload) {
			await this.markFailed(item, ErrorCode.VALIDATION_FAILED);
			return;
		}
		try {
			const response = item.payload.type === "file"
				? await this.sendFile(client, item.chatId, item.payload)
				: await this.adapter.handlePlatformWebhook({chatId: item.chatId, payload: item.payload}, job.idInstance);
			await this.markSent(item, (response as SendResponse).idMessage);
		} catch (error) {
			const message = redactSecrets(error instanceof Error ? error.message : String(error));
			await this.markFailed(item, message.slice(0, ERROR_MAX_LENGTH));
		}
	}

	private async sendFile(client: GreenApiClient, chatId: string, payload: Extract<OutboundPayload, { type: "file" }>): Promise<SendResponse> {
		const download = await downloadPublicUrl(payload.url);
		return client.sendFileByUpload({
			chatId,
			file: {data: new Blob([download.data], download.contentType ? {type: download.contentType} : undefined), fileName: payload.fileName},
			caption: payload.caption || undefined,
		});
	}

	private async markSent(item: SendJobItem, idMessage: string): Promise<void> {
		await this.prisma.$transaction([
			this.prisma.sendJobItem.update({
				where: {id: item.id},
				data: {status: "sent", idMessage, sentAt: new Date(), payload: Prisma.DbNull},
			}),
			this.prisma.sendJob.update({where: {id: item.jobId}, data: {sent: {increment: 1}}}),
		]);
	}

	private async markFailed(item: SendJobItem, error: string): Promise<void> {
		await this.prisma.$transaction([
			this.prisma.sendJobItem.update({
				where: {id: item.id},
				data: {status: "failed", error, payload: Prisma.DbNull},
			}),
			this.prisma.sendJob.update({where: {id: item.jobId}, data: {failed: {increment: 1}}}),
		]);
	}

	private async failRemaining(jobId: string, error: string): Promise<void> {
		const {count} = await this.prisma.sendJobItem.updateMany({
			where: {jobId, status: "queued"},
			data: {status: "failed", error, payload: Prisma.DbNull},
		});
		await this.prisma.sendJob.update({where: {id: jobId}, data: {failed: {increment: count}}});
	}

	private async finish(jobId: string): Promise<void> {
		await this.prisma.sendJob.updateMany({
			where: {id: jobId, status: "running"},
			data: {status: "done", finishedAt: new Date()},
		});
	}

	private async isCancelled(jobId: string): Promise<boolean> {
		const job = await this.prisma.sendJob.findUnique({where: {id: jobId}, select: {status: true}});
		return job?.status !== "running";
	}

	private async isAuthorized(client: GreenApiClient): Promise<boolean> {
		try {
			return (await client.getStateInstance()).stateInstance === "authorized";
		} catch {
			return false;
		}
	}
}
