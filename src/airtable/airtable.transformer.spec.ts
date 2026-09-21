import { IntegrationError } from "@green-api/greenapi-integration";
import { OutboundPayload } from "../types";
import { AirtableTransformer } from "./airtable.transformer";

const CHAT = "12125550123@c.us";
const transformer = new AirtableTransformer();

function toMessage(payload: OutboundPayload) {
	return transformer.toGreenApiMessage({chatId: CHAT, payload});
}

describe("AirtableTransformer.toGreenApiMessage", () => {
	it("text", () => {
		expect(toMessage({type: "text", text: "hello"})).toEqual({type: "text", chatId: CHAT, message: "hello"});
	});

	it("file by url, empty caption dropped", () => {
		expect(toMessage({type: "file", url: "https://example.com/a.pdf", fileName: "a.pdf", caption: ""})).toEqual({
			type: "url-file",
			chatId: CHAT,
			file: {url: "https://example.com/a.pdf", fileName: "a.pdf"},
			caption: undefined,
		});
	});

	it("location with optional name and address", () => {
		expect(toMessage({type: "location", latitude: 51.5, longitude: -0.12, name: "Office", address: ""})).toEqual({
			type: "location",
			chatId: CHAT,
			latitude: 51.5,
			longitude: -0.12,
			nameLocation: "Office",
			address: undefined,
		});
	});

	it("contact phone becomes a number of digits only", () => {
		expect(toMessage({type: "contact", phone: "+1 (212) 555-0123", firstName: "Ann", company: "Example Ltd"})).toEqual({
			type: "contact",
			chatId: CHAT,
			contact: {phoneContact: 12125550123, firstName: "Ann", middleName: undefined, lastName: undefined, company: "Example Ltd"},
		});
	});

	it("poll options are wrapped as optionName objects", () => {
		expect(toMessage({type: "poll", question: "Tea?", options: ["yes", "no"], multipleAnswers: true})).toEqual({
			type: "poll",
			chatId: CHAT,
			message: "Tea?",
			options: [{optionName: "yes"}, {optionName: "no"}],
			multipleAnswers: true,
		});
	});

	it("reply-only buttons become interactive-buttons-reply with 1-based ids", () => {
		expect(toMessage({type: "buttons", body: "Pick", buttons: [{type: "reply", text: "A"}, {type: "reply", text: "B"}]})).toEqual({
			type: "interactive-buttons-reply",
			chatId: CHAT,
			header: undefined,
			body: "Pick",
			footer: undefined,
			buttons: [{buttonId: "1", buttonText: "A"}, {buttonId: "2", buttonText: "B"}],
		});
	});

	it("action buttons become interactive-buttons with the value in the type-specific key", () => {
		const message = toMessage({
			type: "buttons",
			header: "Hi",
			body: "Pick",
			footer: "Bye",
			buttons: [
				{type: "url", text: "Site", value: "https://example.com"},
				{type: "call", text: "Call", value: "+12125550100"},
				{type: "copy", text: "Code", value: "PROMO10"},
			],
		});
		expect(message).toEqual({
			type: "interactive-buttons",
			chatId: CHAT,
			header: "Hi",
			body: "Pick",
			footer: "Bye",
			buttons: [
				{buttonId: "1", buttonText: "Site", type: "url", url: "https://example.com"},
				{buttonId: "2", buttonText: "Call", type: "call", phoneNumber: "+12125550100"},
				{buttonId: "3", buttonText: "Code", type: "copy", copyCode: "PROMO10"},
			],
		});
	});

	it("refuses a reply button among action buttons", () => {
		expect(() => toMessage({type: "buttons", body: "Pick", buttons: [{type: "url", text: "Site", value: "https://example.com"}, {type: "reply", text: "A"}]})).toThrow(IntegrationError);
	});

	it("never delivers webhooks directly", () => {
		expect(() => transformer.toPlatformMessage({typeWebhook: "incomingMessageReceived"} as never)).toThrow(IntegrationError);
	});
});
