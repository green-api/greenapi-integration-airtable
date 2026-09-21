import { Injectable } from "@nestjs/common";
import { GreenApiLogger, GreenApiWebhook, MessageWebhook, OutgoingMessageStatusWebhook } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { Instance, Prisma } from "../generated/prisma/client";
import { AirtableAdapter } from "../airtable/airtable.adapter";
import { AirtableApiService } from "../airtable-api/airtable-api.service";
import { ContactResolver } from "./contact-resolver";
import { MessageIndex } from "./message-index";
import { MessageRow, toFields, toMessageRow } from "./message-row";
import { JournalItem, journalToRow } from "./journal-row";
import { apiError, ErrorCode } from "../errors";
import { greenApiCall } from "../green-api-call";
import { HANDLED_WEBHOOK_TYPES } from "../defaults";
import { ImportResult, InboundConfig, JobWriteBack } from "../types";

interface Target {
	baseId: string;
	idInstance: bigint;
	config: InboundConfig;
}

@Injectable()
export class InboundService {
	private readonly logger = GreenApiLogger.getInstance(InboundService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly adapter: AirtableAdapter,
		private readonly api: AirtableApiService,
		private readonly contacts: ContactResolver,
		private readonly messages: MessageIndex,
	) {}

	async ingest(webhook: GreenApiWebhook): Promise<void> {
		if (!(HANDLED_WEBHOOK_TYPES as readonly string[]).includes(webhook.typeWebhook)) {
			return;
		}
		if (webhook.typeWebhook === "stateInstanceChanged") {
			await this.adapter.handleStateInstanceWebhook(webhook);
			return;
		}
		const instance = await this.prisma.instance.findUnique({
			where: {idInstance: BigInt(webhook.instanceData.idInstance)},
			include: {base: {include: {airtable: true}}},
		});
		if (!instance || !instance.receiveWebhooks) {
			return;
		}
		const context = {baseId: instance.baseId, idInstance: Number(instance.idInstance), type: webhook.typeWebhook, idMessage: "idMessage" in webhook ? webhook.idMessage : null};
		if (!instance.base.airtable || !instance.base.inbound) {
			this.logger.warn("Webhook received but the base is not ready for delivery; GREEN-API will retry", context);
			throw apiError(ErrorCode.INBOUND_NOT_CONFIGURED, "Airtable access or the messages table is not configured for this base", 503);
		}
		const target: Target = {baseId: instance.baseId, idInstance: instance.idInstance, config: instance.base.inbound};
		try {
			await this.deliver(target, webhook);
			this.logger.info("Webhook written to Airtable", context);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn("Webhook delivery failed; GREEN-API will retry", {...context, error: message});
			throw apiError(ErrorCode.INBOUND_DELIVERY_FAILED, `Could not write the webhook into Airtable: ${message}`, 503);
		}
	}

	async importHistory(instance: Instance, minutes: number): Promise<ImportResult> {
		const target = await this.targetFor(instance);
		const client = this.adapter.createGreenApiClient(instance);
		const [incoming, outgoing] = await greenApiCall(() => Promise.all([client.lastIncomingMessages(minutes), client.lastOutgoingMessages(minutes)]));
		const result = await this.importItems(target, [...incoming, ...outgoing] as unknown as JournalItem[]);
		this.logger.info("History imported", {baseId: target.baseId, idInstance: Number(instance.idInstance), minutes, ...result});
		return result;
	}

	async importChat(instance: Instance, chatId: string, count: number): Promise<ImportResult> {
		const target = await this.targetFor(instance);
		const items = await greenApiCall(() => this.adapter.createGreenApiClient(instance).getChatHistory({chatId, count}));
		const result = await this.importItems(target, items as unknown as JournalItem[]);
		this.logger.info("Chat history imported", {baseId: target.baseId, idInstance: Number(instance.idInstance), chatId, count, ...result});
		return result;
	}

	private async targetFor(instance: Instance): Promise<Target> {
		const base = await this.prisma.base.findUnique({where: {id: instance.baseId}, include: {airtable: true}});
		if (!base?.airtable || !base.inbound) {
			throw apiError(ErrorCode.INBOUND_NOT_CONFIGURED, "Grant Airtable access and choose a messages table in Settings → Receiving first", 409);
		}
		return {baseId: base.id, idInstance: instance.idInstance, config: base.inbound};
	}

	private async importItems(target: Target, items: JournalItem[]): Promise<ImportResult> {
		const known = await this.messages.known(target.baseId, target.config, items.map(item => item.idMessage));
		const seen = new Set<string>();
		const fresh = items
			.filter(item => item.idMessage && !known.has(item.idMessage) && !seen.has(item.idMessage) && seen.add(item.idMessage))
			.sort((a, b) => a.timestamp - b.timestamp);
		const rows: Array<{ row: MessageRow; contactRecordId: string | null }> = [];
		for (const item of fresh) {
			const row = journalToRow(item, target.idInstance);
			rows.push({row, contactRecordId: await this.contacts.resolve(target.baseId, target.config, row.chatId, item.type === "incoming" ? item.senderPhoneNumber : undefined)});
		}
		const created = await this.api.createRecords(target.baseId, target.config.tableId, rows.map(({row, contactRecordId}) => toFields(row, target.config.fields, contactRecordId)));
		return {imported: created.length, skipped: items.length - created.length};
	}

	async setInboundConfig(baseId: string, config: InboundConfig | null): Promise<InboundConfig | null> {
		await this.prisma.base.update({where: {id: baseId}, data: {inbound: config ?? Prisma.DbNull}});
		return config;
	}

	private async deliver(target: Target, webhook: GreenApiWebhook): Promise<void> {
		switch (webhook.typeWebhook) {
			case "incomingMessageReceived":
			case "outgoingMessageReceived":
			case "outgoingAPIMessageReceived":
				await this.deliverMessage(target, webhook);
				return;
			case "outgoingMessageStatus":
				await this.deliverStatus(target, webhook);
				return;
			default:
				return;
		}
	}

	private async deliverMessage(target: Target, webhook: MessageWebhook): Promise<void> {
		if (await this.messages.find(target.baseId, target.config, webhook.idMessage)) {
			return;
		}
		const row = toMessageRow(webhook);
		const contactRecordId = await this.resolveContact(target, webhook);
		await this.api.createRecords(target.baseId, target.config.tableId, [toFields(row, target.config.fields, contactRecordId)]);
	}

	private async resolveContact(target: Target, webhook: MessageWebhook): Promise<string | null> {
		if (webhook.typeWebhook === "outgoingAPIMessageReceived" && target.config.contactLink) {
			const item = await this.findJobItem(target.idInstance, webhook.idMessage);
			if (item?.recordId && item.job.writeBack?.tableId === target.config.contactLink.tableId) {
				return item.recordId;
			}
		}
		return this.contacts.resolve(target.baseId, target.config, webhook.senderData.chatId, webhook.typeWebhook === "incomingMessageReceived" ? webhook.senderData.senderPhoneNumber : undefined);
	}

	private async deliverStatus(target: Target, webhook: OutgoingMessageStatusWebhook): Promise<void> {
		const status = webhook.status;
		if (target.config.fields.status) {
			const recordId = await this.messages.find(target.baseId, target.config, webhook.idMessage);
			if (recordId) {
				await this.api.updateRecords(target.baseId, target.config.tableId, [{id: recordId, fields: {[target.config.fields.status]: status}}]);
			}
		}
		const item = await this.findJobItem(target.idInstance, webhook.idMessage);
		const writeBack: JobWriteBack | null | undefined = item?.job.writeBack;
		if (item?.recordId && writeBack?.statusFieldId) {
			const value = writeBack.statusFieldType === "singleSelect" ? status : statusText(status, webhook.description);
			await this.api.updateRecords(target.baseId, writeBack.tableId, [
				{id: item.recordId, fields: {[writeBack.statusFieldId]: value}},
			]);
		}
	}

	private findJobItem(idInstance: bigint, idMessage: string) {
		return this.prisma.sendJobItem.findFirst({
			where: {idMessage, job: {idInstance}},
			include: {job: {select: {writeBack: true}}},
		});
	}
}

function statusText(status: string, description?: string): string {
	return description && status === "failed" ? `${status}: ${description}` : status;
}
