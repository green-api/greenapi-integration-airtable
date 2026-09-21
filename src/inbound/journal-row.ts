import { DIRECTION_INCOMING, DIRECTION_OUTGOING } from "../defaults";
import { MessageRow, typeLabel } from "./message-row";

export interface JournalItem {
	type: "incoming" | "outgoing";
	idMessage: string;
	timestamp: number;
	typeMessage: string;
	chatId: string;
	senderId?: string;
	senderName?: string;
	senderContactName?: string;
	senderPhoneNumber?: number;
	statusMessage?: string;
	textMessage?: string;
	extendedTextMessage?: { text?: string };
	downloadUrl?: string;
	caption?: string;
	fileName?: string;
	location?: { nameLocation?: string; address?: string; latitude?: number; longitude?: number };
	contact?: { displayName?: string; vcard?: string };
	pollMessageData?: { name?: string; options?: Array<{ optionName: string }>; multipleAnswers?: boolean };
	quotedMessage?: { stanzaId?: string };
	extendedTextMessageData?: { text?: string };
}

function pretty(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

export function journalToRow(item: JournalItem, idInstance: bigint): MessageRow {
	const outgoing = item.type === "outgoing";
	const type = typeLabel(item.typeMessage);
	const row: MessageRow = {
		direction: outgoing ? DIRECTION_OUTGOING : DIRECTION_INCOMING,
		chatId: item.chatId,
		senderName: outgoing ? "" : item.senderContactName || item.senderName || "",
		type,
		text: item.textMessage ?? item.extendedTextMessage?.text ?? item.extendedTextMessageData?.text ?? item.caption ?? "",
		attachments: item.downloadUrl ? [{url: item.downloadUrl, filename: item.fileName || type}] : [],
		timestamp: new Date(item.timestamp * 1000).toISOString(),
		idMessage: item.idMessage,
		status: outgoing ? item.statusMessage ?? "sent" : null,
		instance: String(idInstance),
		quotedMessageId: item.quotedMessage?.stanzaId ?? null,
		location: null,
		details: null,
	};
	if (item.location) {
		const loc = item.location;
		row.text = [loc.nameLocation, loc.address].filter(Boolean).join(", ");
		row.location = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
		row.details = pretty({latitude: loc.latitude, longitude: loc.longitude});
	}
	if (item.contact) {
		row.text = item.contact.displayName ?? "";
		row.details = item.contact.vcard ?? null;
	}
	if (item.pollMessageData) {
		row.text = item.pollMessageData.name ?? "";
		row.details = pretty({options: (item.pollMessageData.options ?? []).map(o => o.optionName), multipleAnswers: item.pollMessageData.multipleAnswers ?? false});
	}
	return row;
}
