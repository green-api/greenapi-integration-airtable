import { Injectable } from "@nestjs/common";
import { generateRandomToken, GreenApiLogger } from "@green-api/greenapi-integration";
import { AutomationKey, Base } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InstancesService } from "../instances/instances.service";
import { JobsService } from "../jobs/jobs.service";
import { hashKey } from "../bases/base-key";
import { apiError, ErrorCode } from "../errors";
import { AUTOMATION_KEY_PREFIX, AUTOMATION_SEND_POLL_MS, AUTOMATION_SEND_TIMEOUT_MS, BASE_KEY_BYTES } from "../defaults";
import { AutomationKeyView, AutomationSendResult } from "../types";
import { CreateAutomationKeyDto } from "./dto/create-automation-key.dto";
import { AutomationSendDto } from "./dto/automation-send.dto";

export function toAutomationKeyView(key: AutomationKey): AutomationKeyView {
	return {
		id: key.id,
		name: key.name,
		idInstance: key.idInstance === null ? null : Number(key.idInstance),
		createdAt: key.createdAt.toISOString(),
		lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
	};
}

@Injectable()
export class AutomationService {
	private readonly logger = GreenApiLogger.getInstance(AutomationService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly instances: InstancesService,
		private readonly jobs: JobsService,
	) {}

	async list(baseId: string): Promise<AutomationKeyView[]> {
		const keys = await this.prisma.automationKey.findMany({where: {baseId}, orderBy: {createdAt: "asc"}});
		return keys.map(toAutomationKeyView);
	}

	async create(baseId: string, dto: CreateAutomationKeyDto): Promise<{ key: string; automationKey: AutomationKeyView }> {
		if (dto.idInstance) {
			await this.instances.getOwned(baseId, dto.idInstance);
		}
		const key = `${AUTOMATION_KEY_PREFIX}${generateRandomToken(BASE_KEY_BYTES)}`;
		const created = await this.prisma.automationKey.create({
			data: {baseId, name: dto.name.trim(), keyHash: hashKey(key), idInstance: dto.idInstance ? BigInt(dto.idInstance) : null},
		});
		this.logger.info("Automation key created", {baseId, keyId: created.id, idInstance: dto.idInstance ?? null});
		return {key, automationKey: toAutomationKeyView(created)};
	}

	async revoke(baseId: string, keyId: string): Promise<AutomationKeyView> {
		const existing = await this.prisma.automationKey.findUnique({where: {id: keyId}});
		if (!existing || existing.baseId !== baseId) {
			throw apiError(ErrorCode.AUTOMATION_KEY_NOT_FOUND, "Automation key not found", 404);
		}
		await this.prisma.automationKey.delete({where: {id: keyId}});
		this.logger.info("Automation key revoked", {baseId, keyId});
		return toAutomationKeyView(existing);
	}

	findByKey(key: string): Promise<AutomationKey | null> {
		return this.prisma.automationKey.findUnique({where: {keyHash: hashKey(key)}});
	}

	async touch(keyId: string): Promise<void> {
		await this.prisma.automationKey.update({where: {id: keyId}, data: {lastUsedAt: new Date()}});
	}

	async send(base: Base, key: AutomationKey, dto: AutomationSendDto): Promise<AutomationSendResult> {
		if (key.idInstance !== null && Number(key.idInstance) !== dto.idInstance) {
			throw apiError(ErrorCode.INSTANCE_FORBIDDEN, "This automation key may only send with its assigned instance", 403);
		}
		const instance = await this.instances.getOwned(base.id, dto.idInstance);
		const {jobId} = await this.jobs.enqueue(base.id, instance, [{recordId: dto.recordId, phone: dto.phone, payload: dto.payload}], dto.writeBack);
		this.logger.info("Automation send accepted", {baseId: base.id, keyId: key.id, jobId});
		return this.awaitResult(jobId);
	}

	private async awaitResult(jobId: string): Promise<AutomationSendResult> {
		const deadline = Date.now() + AUTOMATION_SEND_TIMEOUT_MS;
		for (;;) {
			const item = await this.prisma.sendJobItem.findFirstOrThrow({where: {jobId}});
			if (item.status === "sent") {
				return {jobId, status: "sent", chatId: item.chatId, idMessage: item.idMessage, error: null};
			}
			if (item.status === "failed" || item.status === "skipped") {
				return {jobId, status: "failed", chatId: item.chatId, idMessage: null, error: item.error};
			}
			if (Date.now() >= deadline) {
				return {jobId, status: "queued", chatId: item.chatId, idMessage: null, error: null};
			}
			await new Promise(resolve => setTimeout(resolve, AUTOMATION_SEND_POLL_MS));
		}
	}
}
