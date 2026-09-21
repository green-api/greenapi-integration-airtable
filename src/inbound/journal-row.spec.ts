import { DIRECTION_INCOMING, DIRECTION_OUTGOING } from "../defaults";
import { JournalItem, journalToRow } from "./journal-row";

const ID_INSTANCE = 1101000001n;
const AT = 1_760_000_000;

function item(extra: Partial<JournalItem>): JournalItem {
	return {type: "incoming", idMessage: "3EB0JOURNAL00000001", timestamp: AT, typeMessage: "textMessage", chatId: "12125550123@c.us", senderName: "Ann", senderContactName: "Ann (saved)", ...extra};
}

describe("journalToRow", () => {
	it("maps an incoming text item from the flat journal shape", () => {
		expect(journalToRow(item({textMessage: "hello"}), ID_INSTANCE)).toMatchObject({
			direction: DIRECTION_INCOMING,
			chatId: "12125550123@c.us",
			senderName: "Ann (saved)",
			type: "text",
			text: "hello",
			attachments: [],
			timestamp: new Date(AT * 1000).toISOString(),
			status: null,
			instance: "1101000001",
		});
	});

	it("uses the journal status for outgoing items and drops the sender", () => {
		const row = journalToRow(item({type: "outgoing", statusMessage: "read", textMessage: "x"}), ID_INSTANCE);
		expect(row.direction).toBe(DIRECTION_OUTGOING);
		expect(row.status).toBe("read");
		expect(row.senderName).toBe("");
	});

	it("reads extended text and media fields at the top level", () => {
		expect(journalToRow(item({typeMessage: "extendedTextMessage", extendedTextMessage: {text: "link text"}}), ID_INSTANCE).text).toBe("link text");
		const media = journalToRow(item({typeMessage: "imageMessage", downloadUrl: "https://files.example.com/a.jpg", caption: "look", fileName: "a.jpg"}), ID_INSTANCE);
		expect(media.type).toBe("image");
		expect(media.text).toBe("look");
		expect(media.attachments).toEqual([{url: "https://files.example.com/a.jpg", filename: "a.jpg"}]);
	});

	it("maps location, contact and poll objects", () => {
		const loc = journalToRow(item({typeMessage: "locationMessage", location: {nameLocation: "Office", address: "1 Main St", latitude: 51.5, longitude: -0.12}}), ID_INSTANCE);
		expect(loc.text).toBe("Office, 1 Main St");
		expect(loc.location).toBe("https://maps.google.com/?q=51.5,-0.12");
		const contact = journalToRow(item({typeMessage: "contactMessage", contact: {displayName: "Bob", vcard: "BEGIN:VCARD"}}), ID_INSTANCE);
		expect(contact.text).toBe("Bob");
		expect(contact.details).toBe("BEGIN:VCARD");
		const poll = journalToRow(item({typeMessage: "pollMessage", pollMessageData: {name: "Tea?", options: [{optionName: "yes"}, {optionName: "no"}]}}), ID_INSTANCE);
		expect(poll.text).toBe("Tea?");
		expect(JSON.parse(poll.details as string)).toEqual({options: ["yes", "no"], multipleAnswers: false});
	});

	it("keeps the quoted message id", () => {
		expect(journalToRow(item({typeMessage: "quotedMessage", textMessage: "yes", quotedMessage: {stanzaId: "3EB0QUOTED000000000"}}), ID_INSTANCE).quotedMessageId).toBe("3EB0QUOTED000000000");
	});
});
