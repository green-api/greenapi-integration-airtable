import { ContactResolver } from "./contact-resolver";
import { InboundConfig } from "../types";

jest.mock("../airtable-api/airtable-api.service", () => ({AirtableApiService: class {}}));
jest.mock("./schema-cache", () => ({SchemaCache: class {}}));

const BASE = "appTESTBASE0000001";
const CONTACTS = "tblCONTACTS000001";
const PHONE_FIELD = "fldPHONE000000001";
const CHAT_ID_FIELD = "fldCHATID00000001";

function config(chatIdFieldId: string | null): InboundConfig {
	return {
		tableId: "tblMESSAGES000001",
		fields: {idMessage: "fldID00000000001", direction: "fldDIR0000000001", chatId: "fldCHAT000000001", text: "fldTEXT000000001", contact: "fldLINK000000001"},
		contactLink: {tableId: CONTACTS, phoneFieldId: PHONE_FIELD, chatIdFieldId},
	};
}

function setup(records: Record<string, string>) {
	const findRecords = jest.fn(async (_base: string, _table: string, formula: string) => {
		const digits = /= "(\d+)"$/.exec(formula)?.[1] ?? "";
		const field = /^REGEX_REPLACE\({([^}]+)}/.exec(formula)?.[1] ?? "";
		const id = records[`${field}:${digits}`];
		return id ? [{id, fields: {}}] : [];
	});
	const schema = {fieldName: jest.fn(async (_base: string, _table: string, fieldId: string) => (fieldId === PHONE_FIELD ? "Phone" : fieldId === CHAT_ID_FIELD ? "Chat ID" : null))};
	const resolver = new ContactResolver({findRecords} as never, schema as never);
	return {resolver, findRecords};
}

describe("ContactResolver", () => {
	it("matches WhatsApp chat ids by phone digits", async () => {
		const {resolver, findRecords} = setup({"Phone:12125550123": "recPHONE"});
		expect(await resolver.resolve(BASE, config(CHAT_ID_FIELD), "12125550123@c.us")).toBe("recPHONE");
		expect(findRecords).toHaveBeenCalledTimes(1);
		expect(findRecords.mock.calls[0][2]).toContain("{Phone}");
	});

	it("matches numeric chat ids against the chat id column", async () => {
		const {resolver, findRecords} = setup({"Chat ID:16976233": "recCHAT"});
		expect(await resolver.resolve(BASE, config(CHAT_ID_FIELD), "16976233")).toBe("recCHAT");
		expect(findRecords.mock.calls[0][2]).toContain("{Chat ID}");
	});

	it("falls back to the sender phone when the chat id is unknown", async () => {
		const {resolver, findRecords} = setup({"Phone:12125550123": "recPHONE"});
		expect(await resolver.resolve(BASE, config(CHAT_ID_FIELD), "16976233", 12125550123)).toBe("recPHONE");
		expect(findRecords).toHaveBeenCalledTimes(2);
	});

	it("uses only the sender phone when no chat id column is mapped", async () => {
		const {resolver, findRecords} = setup({"Phone:12125550123": "recPHONE"});
		expect(await resolver.resolve(BASE, config(null), "16976233", 12125550123)).toBe("recPHONE");
		expect(findRecords).toHaveBeenCalledTimes(1);
	});

	it("returns null for a numeric chat id without column or phone", async () => {
		const {resolver, findRecords} = setup({});
		expect(await resolver.resolve(BASE, config(null), "16976233")).toBeNull();
		expect(findRecords).not.toHaveBeenCalled();
	});

	it("never links groups", async () => {
		const {resolver, findRecords} = setup({"Phone:12125550123": "recPHONE"});
		expect(await resolver.resolve(BASE, config(CHAT_ID_FIELD), "12125550123-1600000000@g.us", 12125550123)).toBeNull();
		expect(findRecords).not.toHaveBeenCalled();
	});

	it("caches lookups per base, table and key", async () => {
		const {resolver, findRecords} = setup({"Chat ID:16976233": "recCHAT"});
		await resolver.resolve(BASE, config(CHAT_ID_FIELD), "16976233");
		await resolver.resolve(BASE, config(CHAT_ID_FIELD), "16976233");
		expect(findRecords).toHaveBeenCalledTimes(1);
	});

	it("does nothing when the link is not configured", async () => {
		const {resolver, findRecords} = setup({"Phone:12125550123": "recPHONE"});
		expect(await resolver.resolve(BASE, {...config(null), contactLink: null}, "12125550123@c.us")).toBeNull();
		expect(findRecords).not.toHaveBeenCalled();
	});
});
