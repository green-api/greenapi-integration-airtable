import { Injectable } from "@nestjs/common";
import { GreenApiLogger } from "@green-api/greenapi-integration";
import { Instance } from "../generated/prisma/client";
import { AirtableAdapter } from "../airtable/airtable.adapter";
import { InboundService } from "../inbound/inbound.service";
import { toChatId } from "../jobs/phone";
import { apiError, ErrorCode } from "../errors";
import { greenApiCall } from "../green-api-call";
import { redactSecrets } from "../redact";
import { CHAT_HISTORY_DEFAULT_COUNT, CONTACT_TYPE_USER, PHONE_CHAT_ID } from "../defaults";
import { CheckResult, ContactView, ImportResult, QrView, QueueView } from "../types";

@Injectable()
export class ToolsService {
	private readonly logger = GreenApiLogger.getInstance(ToolsService.name);

	constructor(
		private readonly adapter: AirtableAdapter,
		private readonly inbound: InboundService,
	) {}

	async checkNumbers(instance: Instance, phones: string[]): Promise<CheckResult[]> {
		const client = this.adapter.createGreenApiClient(instance);
		const results: CheckResult[] = [];
		for (const phone of phones) {
			const digits = phone.replace(/\D/g, "");
			if (!digits) {
				results.push({phone, exists: null, chatId: null, error: "no digits in the phone"});
				continue;
			}
			try {
				if (instance.messenger === "whatsapp") {
					const {existsWhatsapp} = await client.checkWhatsapp({phoneNumber: Number(digits)});
					results.push({phone, exists: existsWhatsapp, chatId: existsWhatsapp ? `${digits}@c.us` : null, error: null});
				} else {
					const {exist, chatId} = await client.checkAccount({phoneNumber: Number(digits)});
					results.push({phone, exists: exist, chatId: exist && chatId ? chatId : null, error: null});
				}
			} catch (error) {
				results.push({phone, exists: null, chatId: null, error: redactSecrets(error instanceof Error ? error.message : String(error))});
			}
		}
		this.logger.info("Numbers checked", {idInstance: Number(instance.idInstance), total: phones.length, failed: results.filter(r => r.error).length});
		return results;
	}

	importHistory(instance: Instance, minutes: number): Promise<ImportResult> {
		return this.inbound.importHistory(instance, minutes);
	}

	async importChat(instance: Instance, recipient: string, count: number | undefined): Promise<ImportResult> {
		const chatId = toChatId(recipient, instance.messenger);
		if (!chatId) {
			throw apiError(ErrorCode.PHONE_INVALID, "The recipient is not a valid phone number or chat id", 400);
		}
		return this.inbound.importChat(instance, await this.journalChatId(instance, chatId), count ?? CHAT_HISTORY_DEFAULT_COUNT);
	}

	private async journalChatId(instance: Instance, chatId: string): Promise<string> {
		const phone = PHONE_CHAT_ID.exec(chatId);
		if (instance.messenger === "whatsapp" || !phone) {
			return chatId;
		}
		const account = await greenApiCall(() => this.adapter.createGreenApiClient(instance).checkAccount({phoneNumber: Number(phone[1])}));
		if (!account.exist || !account.chatId) {
			throw apiError(ErrorCode.RECIPIENT_NOT_FOUND, `No ${instance.messenger === "max" ? "MAX" : "Telegram"} account for this phone number`, 404);
		}
		return account.chatId;
	}

	async qr(instance: Instance): Promise<QrView> {
		const qr = await greenApiCall(() => this.adapter.createGreenApiClient(instance).getQR());
		if (qr.type === "qrCode") {
			return {status: "qr", image: qr.message, message: null};
		}
		if (qr.type === "alreadyLogged") {
			return {status: "authorized", image: null, message: null};
		}
		return {status: "error", image: null, message: qr.message};
	}

	async queue(instance: Instance): Promise<QueueView> {
		const queued = await greenApiCall(() => this.adapter.createGreenApiClient(instance).showMessagesQueue());
		return {count: queued.length};
	}

	async clearQueue(instance: Instance): Promise<QueueView> {
		await greenApiCall(() => this.adapter.createGreenApiClient(instance).clearMessagesQueue());
		this.logger.info("Message queue cleared", {idInstance: Number(instance.idInstance)});
		return {count: 0};
	}

	async contacts(instance: Instance): Promise<ContactView[]> {
		const contacts = await greenApiCall(() => this.adapter.createGreenApiClient(instance).getContacts());
		return contacts
			.filter(contact => contact.type === CONTACT_TYPE_USER)
			.map(contact => {
				const chatId = contact.chatId ?? contact.id ?? "";
				const phone = contact.phoneNumber
					? String(contact.phoneNumber)
					: chatId.endsWith("@c.us") ? chatId.replace(/@c\.us$/, "") : null;
				return {chatId, name: contact.contactName || contact.name || "", phone, username: contact.username || null};
			})
			.filter(contact => contact.chatId);
	}
}
