import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Instance } from "../generated/prisma/client";
import { generateRandomToken, GreenApiLogger, Settings } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { requireEnv } from "../env";
import { AirtableAdapter } from "../airtable/airtable.adapter";
import { CreateInstanceDto } from "./dto/create-instance.dto";
import { toInstanceView } from "./instance-view";
import { InstanceView } from "../types";
import { apiError, ErrorCode } from "../errors";
import { greenApiCall } from "../green-api-call";
import { API_PREFIX, INSTANCE_REFRESH_TTL_MS, RECEIVE_SETTINGS, WEBHOOK_PATH, WEBHOOK_TOKEN_BYTES } from "../defaults";

@Injectable()
export class InstancesService {
	private readonly logger = GreenApiLogger.getInstance(InstancesService.name);
	readonly webhookUrl: string;

	constructor(
		private readonly prisma: PrismaService,
		private readonly adapter: AirtableAdapter,
		config: ConfigService,
	) {
		this.webhookUrl = `${requireEnv(config, "APP_URL").replace(/\/+$/, "")}/${API_PREFIX}/${WEBHOOK_PATH}`;
	}

	async list(baseId: string): Promise<InstanceView[]> {
		const instances = await this.prisma.getInstancesByBase(baseId);
		return Promise.all(instances.map(instance => this.refresh(instance)));
	}

	async add(baseId: string, dto: CreateInstanceDto): Promise<InstanceView> {
		if (await this.prisma.getInstance(dto.idInstance)) {
			throw apiError(ErrorCode.INSTANCE_ALREADY_CONNECTED, "This instance is already connected to a base", 409);
		}
		const apiUrl = dto.apiUrl.replace(/\/+$/, "");
		const verified = await this.adapter.verifyInstance(dto.idInstance, dto.apiTokenInstance, apiUrl);
		const instance = await this.prisma.createInstance({
			idInstance: dto.idInstance,
			apiTokenInstance: dto.apiTokenInstance,
			apiUrl,
			stateInstance: verified.stateInstance,
			name: dto.name ?? null,
			baseId,
			messenger: verified.messenger,
			phone: verified.phone,
		});
		this.logger.info("Instance added", {baseId, idInstance: dto.idInstance, messenger: verified.messenger});
		return toInstanceView(instance);
	}

	async remove(baseId: string, idInstance: number): Promise<InstanceView> {
		const instance = await this.getOwned(baseId, idInstance);
		if (instance.receiveWebhooks) {
			await this.clearWebhook(instance);
		}
		await this.prisma.removeInstance(idInstance);
		this.logger.info("Instance removed", {baseId, idInstance});
		return toInstanceView(instance);
	}

	async setReceive(baseId: string, idInstance: number, receive: boolean): Promise<InstanceView> {
		const instance = await this.getOwned(baseId, idInstance);
		const updated = receive ? await this.enableWebhook(instance) : await this.clearWebhook(instance);
		this.logger.info("Instance receive toggled", {baseId, idInstance, receive});
		return this.refresh(updated);
	}

	async getOwned(baseId: string, idInstance: number): Promise<Instance> {
		const instance = await this.prisma.getInstance(idInstance);
		if (!instance || instance.baseId !== baseId) {
			throw apiError(ErrorCode.INSTANCE_NOT_FOUND, `Instance ${idInstance} is not connected to this base`, 404);
		}
		return instance;
	}

	private async enableWebhook(instance: Instance): Promise<Instance> {
		const webhookUrlToken = generateRandomToken(WEBHOOK_TOKEN_BYTES);
		const settings: Settings = {webhookUrl: this.webhookUrl, webhookUrlToken, ...RECEIVE_SETTINGS};
		await greenApiCall(() => this.adapter.createGreenApiClient(instance).setSettings(settings));
		return this.prisma.instance.update({
			where: {idInstance: instance.idInstance},
			data: {receiveWebhooks: true, settings: {...(instance.settings ?? {}), ...settings}},
		});
	}

	private async clearWebhook(instance: Instance): Promise<Instance> {
		const client = this.adapter.createGreenApiClient(instance);
		try {
			const current = await client.getSettings();
			if (current.webhookUrl === this.webhookUrl) {
				await client.setSettings({webhookUrl: "", webhookUrlToken: ""});
			}
		} catch (error) {
			this.logger.warn("Could not clear webhook on instance", {idInstance: Number(instance.idInstance), error});
		}
		const settings = {...(instance.settings ?? {})};
		delete settings.webhookUrl;
		delete settings.webhookUrlToken;
		return this.prisma.instance.update({
			where: {idInstance: instance.idInstance},
			data: {receiveWebhooks: false, settings},
		});
	}

	private async refresh(instance: Instance): Promise<InstanceView> {
		if (instance.checkedAt && Date.now() - instance.checkedAt.getTime() < INSTANCE_REFRESH_TTL_MS) {
			return toInstanceView(instance);
		}
		const client = this.adapter.createGreenApiClient(instance);
		try {
			const {stateInstance} = await client.getStateInstance();
			const phone = stateInstance === "authorized" ? await this.adapter.readPhone(client, instance.messenger) ?? instance.phone : instance.phone;
			return toInstanceView(await this.prisma.updateInstanceStatus(instance.idInstance, stateInstance, phone));
		} catch (error) {
			this.logger.warn("Instance state refresh failed", {idInstance: Number(instance.idInstance), error: error instanceof Error ? error.message : String(error)});
			return toInstanceView(instance);
		}
	}
}
