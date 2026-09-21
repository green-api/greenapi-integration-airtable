import { MessageWebhook, OutgoingMessageStatusWebhook, WebhookMessageData } from "@green-api/greenapi-integration";
import { DIRECTION_INCOMING, DIRECTION_OUTGOING } from "../defaults";
import { InboundFieldMap } from "../types";
import { Fields } from "../airtable-api/airtable-api.service";

export interface MessageRow {
	direction: string;
	chatId: string;
	senderName: string;
	type: string;
	text: string;
	attachments: Array<{ url: string; filename: string }>;
	timestamp: string;
	idMessage: string;
	status: string | null;
	instance: string;
	quotedMessageId: string | null;
	location: string | null;
	details: string | null;
}

const TYPE_LABELS: Record<WebhookMessageData["typeMessage"], string> = {
	textMessage: "text",
	extendedTextMessage: "text",
	quotedMessage: "text",
	imageMessage: "image",
	videoMessage: "video",
	documentMessage: "document",
	audioMessage: "audio",
	stickerMessage: "sticker",
	locationMessage: "location",
	contactMessage: "contact",
	contactsArrayMessage: "contacts",
	pollMessage: "poll",
	pollUpdateMessage: "pollUpdate",
	reactionMessage: "reaction",
	editedMessage: "edited",
	deletedMessage: "deleted",
	buttonsMessage: "buttons",
	listMessage: "list",
	templateMessage: "template",
	groupInviteMessage: "groupInvite",
	interactiveButtons: "buttons",
	interactiveButtonsReply: "buttonsReply",
	templateButtonsReplyMessage: "buttonsReply",
};

export function typeLabel(typeMessage: string): string {
	return TYPE_LABELS[typeMessage as WebhookMessageData["typeMessage"]] ?? typeMessage;
}

function pretty(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function extract(data: MessageWebhook["messageData"]): Pick<MessageRow, "type" | "text" | "attachments" | "location" | "details"> {
	const base = {type: typeLabel(data.typeMessage), text: "", attachments: [] as MessageRow["attachments"], location: null as string | null, details: null as string | null};
	switch (data.typeMessage) {
		case "textMessage":
			return {...base, text: data.textMessageData.textMessage};
		case "extendedTextMessage":
		case "quotedMessage":
			return {...base, text: data.extendedTextMessageData.text};
		case "imageMessage":
		case "videoMessage":
		case "documentMessage":
		case "audioMessage":
		case "stickerMessage":
			return {
				...base,
				text: data.fileMessageData.caption ?? "",
				attachments: data.fileMessageData.downloadUrl
					? [{url: data.fileMessageData.downloadUrl, filename: data.fileMessageData.fileName || `${base.type}`}]
					: [],
			};
		case "locationMessage": {
			const loc = data.locationMessageData;
			return {
				...base,
				text: [loc.nameLocation, loc.address].filter(Boolean).join(", "),
				location: `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
				details: pretty({latitude: loc.latitude, longitude: loc.longitude}),
			};
		}
		case "contactMessage":
			return {...base, text: data.contactMessageData.displayName, details: data.contactMessageData.vcard};
		case "contactsArrayMessage":
			return {...base, details: pretty(data.messageData)};
		case "pollMessage":
			return {
				...base,
				text: data.pollMessageData.name,
				details: pretty({options: data.pollMessageData.options.map(o => o.optionName), multipleAnswers: data.pollMessageData.multipleAnswers}),
			};
		case "pollUpdateMessage":
			return {...base, text: data.pollMessageData.name, details: pretty({votes: data.pollMessageData.votes, pollMessageId: data.pollMessageData.stanzaId})};
		case "reactionMessage":
			return {...base, text: data.extendedTextMessageData.text};
		case "editedMessage":
			return {...base, text: data.editedMessageData.textMessage ?? data.editedMessageData.caption ?? "", details: pretty(data.editedMessageData)};
		case "deletedMessage":
			return {...base, details: pretty(data.deletedMessageData)};
		case "buttonsMessage":
			return {...base, text: data.buttonsMessage.contentText, details: pretty(data.buttonsMessage.buttons)};
		case "listMessage":
			return {...base, text: data.listMessage.contentText, details: pretty(data.listMessage)};
		case "templateMessage":
			return {...base, text: data.templateMessage.contentText, details: pretty(data.templateMessage)};
		case "groupInviteMessage":
			return {...base, text: data.groupInviteMessageData.groupName, details: pretty(data.groupInviteMessageData)};
		case "interactiveButtons":
			return {...base, text: data.interactiveButtons.contentText, details: pretty(data.interactiveButtons)};
		case "interactiveButtonsReply":
			return {...base, text: data.interactiveButtonsReply.contentText, details: pretty(data.interactiveButtonsReply)};
		case "templateButtonsReplyMessage":
			return {...base, text: data.templateButtonReplyMessage.selectedDisplayText, details: pretty(data.templateButtonReplyMessage)};
		default:
			return {...base, details: pretty(data)};
	}
}

export function toMessageRow(webhook: MessageWebhook): MessageRow {
	const outgoing = webhook.typeWebhook !== "incomingMessageReceived";
	const quoted = webhook.messageData.quotedMessage as { stanzaId?: string } | undefined;
	return {
		direction: outgoing ? DIRECTION_OUTGOING : DIRECTION_INCOMING,
		chatId: webhook.senderData.chatId,
		senderName: outgoing ? "" : webhook.senderData.senderContactName || webhook.senderData.senderName || webhook.senderData.chatName || "",
		timestamp: new Date(webhook.timestamp * 1000).toISOString(),
		idMessage: webhook.idMessage,
		status: outgoing ? "sent" : null,
		instance: String(webhook.instanceData.idInstance),
		quotedMessageId: quoted?.stanzaId ?? null,
		...extract(webhook.messageData),
	};
}

export function statusOf(webhook: OutgoingMessageStatusWebhook): string {
	return webhook.status;
}

export function toFields(row: MessageRow, map: InboundFieldMap, contactRecordId: string | null): Fields {
	const fields: Fields = {};
	const put = (key: keyof InboundFieldMap, value: unknown) => {
		const fieldId = map[key];
		if (fieldId && value !== null && value !== undefined && value !== "") {
			fields[fieldId] = value;
		}
	};
	put("direction", row.direction);
	put("chatId", row.chatId);
	put("senderName", row.senderName);
	put("type", row.type);
	put("text", row.text);
	put("attachments", row.attachments.length > 0 ? row.attachments : null);
	put("timestamp", row.timestamp);
	put("idMessage", row.idMessage);
	put("status", row.status);
	put("instance", row.instance);
	put("quotedMessageId", row.quotedMessageId);
	put("location", row.location);
	put("details", row.details);
	if (contactRecordId) {
		put("contact", [contactRecordId]);
	}
	return fields;
}
