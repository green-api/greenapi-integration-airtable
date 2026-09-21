import { Injectable } from "@nestjs/common";
import { Instance, Prisma, SendJob, SendJobItem } from "../generated/prisma/client";
import { GreenApiLogger } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { InstancesService } from "../instances/instances.service";
import { CreateJobDto, JobItemDto, JobWriteBackDto, toPayload } from "./dto/create-job.dto";
import { JobsRunner } from "./jobs.runner";
import { toChatId } from "./phone";
import { messengerProblem } from "./messenger-rules";
import { toJobSummaryView, toJobView } from "./job-view";
import { JobWriteBack, SendJobSummaryView, SendJobView, UserWithInstances } from "../types";
import { Base } from "../generated/prisma/client";
import { assertCanSend } from "./authorize";
import { apiError, ErrorCode } from "../errors";
import { JOBS_LIST_DEFAULT_LIMIT, JOBS_LIST_MAX_LIMIT } from "../defaults";

@Injectable()
export class JobsService {
	private readonly logger = GreenApiLogger.getInstance(JobsService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly instances: InstancesService,
		private readonly runner: JobsRunner,
	) {}

	async create(base: Base, user: UserWithInstances, dto: CreateJobDto): Promise<{ jobId: string }> {
		assertCanSend(user, dto.idInstance);
		const instance = await this.instances.getOwned(base.id, dto.idInstance);
		return this.enqueue(base.id, instance, dto.items, dto.writeBack);
	}

	async enqueue(baseId: string, instance: Instance, inputs: JobItemDto[], writeBackDto: JobWriteBackDto | undefined): Promise<{ jobId: string }> {
		const items: Prisma.SendJobItemCreateManyJobInput[] = inputs.map((item, position) => {
			const chatId = toChatId(item.phone, instance.messenger);
			const payload = toPayload(item.payload);
			const problem = typeof payload === "string" ? payload : messengerProblem(payload, instance.messenger, chatId ?? "");
			const error = !chatId
				? ErrorCode.PHONE_INVALID
				: problem ? `${ErrorCode.VALIDATION_FAILED}: ${problem}` : null;
			return {
				position,
				recordId: item.recordId ?? null,
				chatId: chatId ?? "",
				payload: error || typeof payload === "string" ? undefined : payload,
				status: error ? "skipped" : "queued",
				error,
			};
		});
		const skipped = items.filter(item => item.status === "skipped").length;
		const writeBack: JobWriteBack | undefined = writeBackDto
			? {
				tableId: writeBackDto.tableId,
				statusFieldId: writeBackDto.statusFieldId ?? null,
				statusFieldType: writeBackDto.statusFieldType ?? null,
			}
			: undefined;
		const job = await this.prisma.sendJob.create({
			data: {
				baseId,
				idInstance: instance.idInstance,
				total: items.length,
				failed: skipped,
				status: skipped === items.length ? "done" : "queued",
				finishedAt: skipped === items.length ? new Date() : null,
				writeBack,
				items: {createMany: {data: items}},
			},
		});
		this.logger.info("Job created", {baseId, jobId: job.id, total: items.length, skipped});
		this.runner.kick(job.idInstance);
		return {jobId: job.id};
	}

	async list(baseId: string, limit: number | undefined): Promise<SendJobSummaryView[]> {
		const jobs = await this.prisma.sendJob.findMany({
			where: {baseId},
			orderBy: {createdAt: "desc"},
			take: Math.min(limit ?? JOBS_LIST_DEFAULT_LIMIT, JOBS_LIST_MAX_LIMIT),
		});
		return jobs.map(toJobSummaryView);
	}

	async get(baseId: string, jobId: string): Promise<SendJobView> {
		const job = await this.getOwned(baseId, jobId, true);
		return toJobView(job);
	}

	async cancel(baseId: string, jobId: string): Promise<SendJobSummaryView> {
		const job = await this.getOwned(baseId, jobId, false);
		if (job.status !== "queued" && job.status !== "running") {
			throw apiError(ErrorCode.JOB_NOT_CANCELLABLE, `Job is already ${job.status}`, 409);
		}
		const cancelled = await this.prisma.sendJob.update({
			where: {id: jobId},
			data: {status: "cancelled", finishedAt: new Date()},
		});
		await this.prisma.sendJobItem.updateMany({
			where: {jobId, status: "queued"},
			data: {status: "skipped", error: ErrorCode.JOB_CANCELLED, payload: Prisma.DbNull},
		});
		this.logger.info("Job cancelled", {baseId, jobId});
		return toJobSummaryView(cancelled);
	}

	private async getOwned(baseId: string, jobId: string, withItems: true): Promise<SendJob & { items: SendJobItem[] }>;
	private async getOwned(baseId: string, jobId: string, withItems: false): Promise<SendJob>;
	private async getOwned(baseId: string, jobId: string, withItems: boolean): Promise<SendJob | (SendJob & { items: SendJobItem[] })> {
		const job = await this.prisma.sendJob.findUnique({
			where: {id: jobId},
			include: withItems ? {items: {orderBy: {position: "asc"}}} : undefined,
		});
		if (!job || job.baseId !== baseId) {
			throw apiError(ErrorCode.JOB_NOT_FOUND, `Job ${jobId} not found`, 404);
		}
		return job;
	}
}
