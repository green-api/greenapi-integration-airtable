import { MessageWebhook } from "@green-api/greenapi-integration";
import { DIRECTION_INCOMING, DIRECTION_OUTGOING } from "../defaults";
import { InboundFieldMap } from "../types";
import { toFields, toMessageRow } from "./message-row";

const ID_INSTANCE = 1101000001;
const CHAT = "12125550123@c.us";
const AT = 1_760_000_000;

function webhook(messageData: Record<string, unknown>, overrides: Partial<Record<string, unknown>> = {}): MessageWebhook {
	return {
		typeWebhook: "incomingMessageReceived",
		instanceData: {idInstance: ID_INSTANCE, wid: "12125550100@c.us", typeInstance: "whatsapp"},
		timestamp: AT,
		idMessage: "3EB0ABCDEF1234567890",
		senderData: {chatId: CHAT, sender: CHAT, chatName: "Ann", senderName: "Ann Example", senderContactName: "Ann (saved)"},
		messageData,
		...overrides,
	} as unknown as MessageWebhook;
}

describe("toMessageRow", () => {
	it("maps an incoming text message", () => {
		const row = toMessageRow(webhook({typeMessage: "textMessage", textMessageData: {textMessage: "hello"}}));
		expect(row).toMatchObject({
			direction: DIRECTION_INCOMING,
			chatId: CHAT,
			senderName: "Ann (saved)",
			type: "text",
			text: "hello",
			attachments: [],
			timestamp: new Date(AT * 1000).toISOString(),
			idMessage: "3EB0ABCDEF1234567890",
			status: null,
			instance: String(ID_INSTANCE),
			quotedMessageId: null,
			location: null,
			details: null,
		});
	});

	it("falls back through the sender name candidates", () => {
		const noSaved = webhook({typeMessage: "textMessage", textMessageData: {textMessage: "x"}}, {senderData: {chatId: CHAT, sender: CHAT, chatName: "Chat", senderName: "Pushname"}});
		expect(toMessageRow(noSaved).senderName).toBe("Pushname");
		const onlyChat = webhook({typeMessage: "textMessage", textMessageData: {textMessage: "x"}}, {senderData: {chatId: CHAT, sender: CHAT, chatName: "Chat", senderName: ""}});
		expect(toMessageRow(onlyChat).senderName).toBe("Chat");
	});

	it("marks outgoing messages as sent with no sender name", () => {
		for (const typeWebhook of ["outgoingMessageReceived", "outgoingAPIMessageReceived"]) {
			const row = toMessageRow(webhook({typeMessage: "textMessage", textMessageData: {textMessage: "x"}}, {typeWebhook}));
			expect(row.direction).toBe(DIRECTION_OUTGOING);
			expect(row.status).toBe("sent");
			expect(row.senderName).toBe("");
		}
	});

	it("turns a media message into an attachment with the caption as text", () => {
		const row = toMessageRow(webhook({typeMessage: "imageMessage", fileMessageData: {downloadUrl: "https://files.example.com/a.jpg", caption: "look", mimeType: "image/jpeg", fileName: "a.jpg"}}));
		expect(row.type).toBe("image");
		expect(row.text).toBe("look");
		expect(row.attachments).toEqual([{url: "https://files.example.com/a.jpg", filename: "a.jpg"}]);
	});

	it("names an attachment by type when the file has no name and drops it when there is no url", () => {
		const unnamed = toMessageRow(webhook({typeMessage: "audioMessage", fileMessageData: {downloadUrl: "https://files.example.com/x", caption: "", mimeType: "audio/ogg", fileName: ""}}));
		expect(unnamed.attachments).toEqual([{url: "https://files.example.com/x", filename: "audio"}]);
		const missing = toMessageRow(webhook({typeMessage: "documentMessage", fileMessageData: {downloadUrl: "", caption: "", mimeType: "application/pdf", fileName: "a.pdf"}}));
		expect(missing.attachments).toEqual([]);
	});

	it("renders a location as a maps link plus coordinates", () => {
		const row = toMessageRow(webhook({typeMessage: "locationMessage", locationMessageData: {nameLocation: "Office", address: "1 Main St", latitude: 51.5, longitude: -0.12}}));
		expect(row.type).toBe("location");
		expect(row.text).toBe("Office, 1 Main St");
		expect(row.location).toBe("https://maps.google.com/?q=51.5,-0.12");
		expect(JSON.parse(row.details as string)).toEqual({latitude: 51.5, longitude: -0.12});
	});

	it("keeps poll options in details", () => {
		const row = toMessageRow(webhook({typeMessage: "pollMessage", pollMessageData: {name: "Tea?", options: [{optionName: "yes"}, {optionName: "no"}], multipleAnswers: false}}));
		expect(row.text).toBe("Tea?");
		expect(JSON.parse(row.details as string)).toEqual({options: ["yes", "no"], multipleAnswers: false});
	});

	it("records the quoted message id on replies", () => {
		const row = toMessageRow(webhook({
			typeMessage: "quotedMessage",
			extendedTextMessageData: {text: "yes please"},
			quotedMessage: {stanzaId: "3EB0QUOTED000000000", participant: CHAT, typeMessage: "textMessage", textMessage: "Tea?"},
		}));
		expect(row.type).toBe("text");
		expect(row.text).toBe("yes please");
		expect(row.quotedMessageId).toBe("3EB0QUOTED000000000");
	});

	it("does not throw on a type it has never seen", () => {
		const row = toMessageRow(webhook({typeMessage: "hologramMessage", hologramData: {x: 1}}));
		expect(row.type).toBe("hologramMessage");
		expect(JSON.parse(row.details as string)).toEqual({typeMessage: "hologramMessage", hologramData: {x: 1}});
	});
});

describe("toFields", () => {
	const map: InboundFieldMap = {idMessage: "fldId", direction: "fldDir", chatId: "fldChat", text: "fldText", attachments: "fldFiles", status: "fldStatus", contact: "fldContact"};

	it("writes only mapped, non-empty values under their field ids", () => {
		const row = toMessageRow(webhook({typeMessage: "textMessage", textMessageData: {textMessage: "hello"}}));
		expect(toFields(row, map, null)).toEqual({fldId: "3EB0ABCDEF1234567890", fldDir: DIRECTION_INCOMING, fldChat: CHAT, fldText: "hello"});
	});

	it("links the contact record when one was resolved", () => {
		const row = toMessageRow(webhook({typeMessage: "textMessage", textMessageData: {textMessage: "hello"}}));
		expect(toFields(row, map, "recCONTACT00000001").fldContact).toEqual(["recCONTACT00000001"]);
	});

	it("passes attachments as an array only when there are some", () => {
		const media = toMessageRow(webhook({typeMessage: "imageMessage", fileMessageData: {downloadUrl: "https://files.example.com/a.jpg", caption: "", mimeType: "image/jpeg", fileName: "a.jpg"}}));
		expect(toFields(media, map, null).fldFiles).toEqual([{url: "https://files.example.com/a.jpg", filename: "a.jpg"}]);
		expect(toFields(media, map, null).fldText).toBeUndefined();
	});
});
