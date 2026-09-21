import { Injectable } from "@nestjs/common";
import { Base, Instance, Messenger } from "../generated/prisma/client";
import {
	BaseAdapter,
	GreenApiClient,
	Instance as LibraryInstance,
	InstanceState,
	StateInstanceWebhook,
} from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { AirtableTransformer } from "./airtable.transformer";
import { SendJobItemInput } from "../types";
import { apiError, ErrorCode } from "../errors";
import { DEFAULT_TYPE_INSTANCE, TYPE_INSTANCE_TO_MESSENGER } from "../defaults";

export interface VerifiedInstance {
	stateInstance: InstanceState;
	messenger: Messenger;
	phone: string | null;
}

@Injectable()
export class AirtableAdapter extends BaseAdapter<SendJobItemInput, never, Base, Instance> {
	constructor(transformer: AirtableTransformer, private readonly prisma: PrismaService) {
		super(transformer, prisma);
	}

	createGreenApiClient(instance: LibraryInstance): GreenApiClient {
		return new GreenApiClient({
			idInstance: instance.idInstance,
			apiTokenInstance: instance.apiTokenInstance,
			apiUrl: instance.apiUrl,
		});
	}

	async createPlatformClient(): Promise<never> {
		throw apiError(ErrorCode.NOT_IMPLEMENTED, "Airtable Web API client is not supported yet", 501);
	}

	async sendToPlatform(): Promise<void> {
		throw apiError(ErrorCode.NOT_IMPLEMENTED, "Writing to Airtable is not supported yet", 501);
	}

	async handleStateInstanceWebhook(webhook: StateInstanceWebhook): Promise<void> {
		await this.prisma.updateInstanceState(webhook.instanceData.idInstance, webhook.stateInstance);
	}

	async verifyInstance(idInstance: number, apiTokenInstance: string, apiUrl: string): Promise<VerifiedInstance> {
		const client = this.createGreenApiClient({idInstance, apiTokenInstance, apiUrl});
		let stateInstance: InstanceState;
		try {
			stateInstance = (await client.getStateInstance()).stateInstance;
		} catch (error) {
			throw apiError(ErrorCode.INSTANCE_CREDENTIALS_INVALID, "GREEN-API rejected idInstance/apiTokenInstance", 400, error);
		}
		const messenger = await this.readMessenger(client);
		return {stateInstance, messenger, phone: await this.readPhone(client, messenger)};
	}

	private async readMessenger(client: GreenApiClient): Promise<Messenger> {
		let typeInstance: string;
		try {
			typeInstance = (await client.getSettings()).typeInstance ?? DEFAULT_TYPE_INSTANCE;
		} catch (error) {
			throw apiError(ErrorCode.INSTANCE_SETTINGS_UNAVAILABLE, "GREEN-API did not return the instance settings", 502, error);
		}
		const messenger = TYPE_INSTANCE_TO_MESSENGER[typeInstance];
		if (!messenger) {
			throw apiError(ErrorCode.MESSENGER_UNSUPPORTED, `Instances of type "${typeInstance}" are not supported`, 400);
		}
		return messenger;
	}

	async readPhone(client: GreenApiClient, messenger: Messenger): Promise<string | null> {
		try {
			const settings = messenger === "whatsapp" ? await client.getWaSettings() : await client.getAccountSettings();
			return settings.phone || null;
		} catch (error) {
			this.gaLogger.warn("Could not read the instance phone", {error: error instanceof Error ? error.message : String(error)});
			return null;
		}
	}
}
