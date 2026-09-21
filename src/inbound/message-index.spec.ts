import { MessageIndex } from "./message-index";
import { equalsAny, quote } from "../airtable-api/formula";
import { ErrorCode } from "../errors";
import { InboundConfig } from "../types";

jest.mock("../airtable-api/airtable-api.service", () => ({AirtableApiService: class {}}));
jest.mock("./schema-cache", () => ({SchemaCache: class {}}));

const BASE = "appTESTBASE0000001";
const ID_FIELD = "fldMSGID000000001";
const config: InboundConfig = {tableId: "tblMESSAGES000001", fields: {idMessage: ID_FIELD, status: "fldSTATUS00000001"}, contactLink: null};

function setup(rows: Array<{id: string; idMessage: string}>, fieldName: string | null = "Message ID") {
	const findRecords = jest.fn(async (_base: string, _table: string, formula: string, _fields: string[], maxRecords: number) =>
		rows.filter(row => formula.includes(quote(row.idMessage))).slice(0, maxRecords).map(row => ({id: row.id, createdTime: "", fields: {[ID_FIELD]: row.idMessage}})),
	);
	const schema = {fieldName: jest.fn(async () => fieldName)};
	return {index: new MessageIndex({findRecords} as never, schema as never), findRecords};
}

describe("formula helpers", () => {
	it("quotes values and strips braces from field names", () => {
		expect(quote('a"b\\c')).toBe('"a\\"b\\\\c"');
		expect(equalsAny("Message} ID", ["x"])).toBe('{Message ID} = "x"');
		expect(equalsAny("Message ID", ["x", "y"])).toBe('OR({Message ID} = "x", {Message ID} = "y")');
	});
});

describe("MessageIndex", () => {
	it("finds the record holding a message id", async () => {
		const {index, findRecords} = setup([{id: "recA", idMessage: "3EB0A"}]);
		expect(await index.find(BASE, config, "3EB0A")).toBe("recA");
		expect(await index.find(BASE, config, "3EB0B")).toBeNull();
		expect(findRecords.mock.calls[0][2]).toBe('{Message ID} = "3EB0A"');
		expect(findRecords.mock.calls[0][4]).toBe(1);
	});

	it("looks up many ids in chunks and returns the ones that exist", async () => {
		const ids = Array.from({length: 120}, (_, i) => `id${i}`);
		const {index, findRecords} = setup([{id: "rec5", idMessage: "id5"}, {id: "rec77", idMessage: "id77"}]);
		const known = await index.known(BASE, config, [...ids, "id5"]);
		expect([...known].sort()).toEqual(["id5", "id77"]);
		expect(findRecords).toHaveBeenCalledTimes(3);
		expect(findRecords.mock.calls[0][4]).toBe(50);
		expect(findRecords.mock.calls[2][4]).toBe(20);
	});

	it("skips the lookup for an empty list", async () => {
		const {index, findRecords} = setup([]);
		expect((await index.known(BASE, config, [])).size).toBe(0);
		expect(findRecords).not.toHaveBeenCalled();
	});

	it("reports a missing Message ID column", async () => {
		const {index} = setup([], null);
		await expect(index.find(BASE, config, "x")).rejects.toMatchObject({code: ErrorCode.INBOUND_NOT_CONFIGURED});
	});
});
