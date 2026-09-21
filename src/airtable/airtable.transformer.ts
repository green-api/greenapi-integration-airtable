import { Injectable } from "@nestjs/common";
import { GreenApiWebhook, Message, MessageTransformer } from "@green-api/greenapi-integration";
import { OutboundButton, OutboundPayload, SendJobItemInput } from "../types";
import { apiError, ErrorCode } from "../errors";

@Injectable()
export class AirtableTransformer extends MessageTransformer<SendJobItemInput, never> {
	toGreenApiMessage(item: SendJobItemInput): Message {
		const {chatId, payload} = item;
		switch (payload.type) {
			case "text":
				return {type: "text", chatId, message: payload.text};
			case "file":
				return {type: "url-file", chatId, file: {url: payload.url, fileName: payload.fileName}, caption: payload.caption || undefined};
			case "location":
				return {
					type: "location",
					chatId,
					latitude: payload.latitude,
					longitude: payload.longitude,
					nameLocation: payload.name || undefined,
					address: payload.address || undefined,
				};
			case "contact":
				return {
					type: "contact",
					chatId,
					contact: {
						phoneContact: Number(payload.phone.replace(/\D/g, "")),
						firstName: payload.firstName || undefined,
						middleName: payload.middleName || undefined,
						lastName: payload.lastName || undefined,
						company: payload.company || undefined,
					},
				};
			case "poll":
				return {
					type: "poll",
					chatId,
					message: payload.question,
					options: payload.options.map(optionName => ({optionName})),
					multipleAnswers: payload.multipleAnswers,
				};
			case "buttons":
				return toButtonsMessage(chatId, payload);
		}
	}

	toPlatformMessage(webhook: GreenApiWebhook): never {
		throw apiError(ErrorCode.NOT_IMPLEMENTED, `Direct platform delivery of ${webhook.typeWebhook} is handled by the inbound pipeline`, 501);
	}
}

function toButtonsMessage(chatId: string, payload: Extract<OutboundPayload, { type: "buttons" }>): Message {
	const common = {chatId, header: payload.header || undefined, body: payload.body, footer: payload.footer || undefined};
	if (payload.buttons.every(button => button.type === "reply")) {
		return {
			type: "interactive-buttons-reply",
			...common,
			buttons: payload.buttons.map((button, index) => ({buttonId: String(index + 1), buttonText: button.text})),
		};
	}
	return {
		type: "interactive-buttons",
		...common,
		buttons: payload.buttons.map((button, index) => toActionButton(button, index)),
	};
}

function toActionButton(button: OutboundButton, index: number) {
	const base = {buttonId: String(index + 1), buttonText: button.text};
	switch (button.type) {
		case "copy":
			return {...base, type: "copy" as const, copyCode: button.value ?? ""};
		case "call":
			return {...base, type: "call" as const, phoneNumber: button.value ?? ""};
		case "url":
			return {...base, type: "url" as const, url: button.value ?? ""};
		default:
			throw apiError(ErrorCode.VALIDATION_FAILED, "Reply buttons cannot be mixed with copy/call/url buttons", 400);
	}
}
