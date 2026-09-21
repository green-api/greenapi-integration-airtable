import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateJobDto, PayloadDto, toPayload } from "./create-job.dto";

function payload(raw: Record<string, unknown>): PayloadDto {
	return plainToInstance(PayloadDto, raw);
}

async function violations(raw: Record<string, unknown>): Promise<string[]> {
	const errors = await validate(plainToInstance(CreateJobDto, raw));
	const paths: string[] = [];
	const walk = (list: typeof errors, prefix: string) => {
		for (const error of list) {
			const path = prefix ? `${prefix}.${error.property}` : error.property;
			if (error.constraints) {
				paths.push(path);
			}
			walk(error.children ?? [], path);
		}
	};
	walk(errors, "");
	return paths;
}

const item = {recordId: "recAbCdEfGhIjKlMn", phone: "+1 212 555 0123", payload: {type: "text", text: "hi"}};

describe("toPayload", () => {
	it("text needs non-blank text", () => {
		expect(toPayload(payload({type: "text", text: "Hello"}))).toEqual({type: "text", text: "Hello"});
		expect(toPayload(payload({type: "text", text: "   "}))).toBe("text is required");
		expect(toPayload(payload({type: "text"}))).toBe("text is required");
	});

	it("file needs url and fileName, caption stays optional", () => {
		expect(toPayload(payload({type: "file", url: "https://example.com/a.pdf", fileName: "a.pdf"}))).toEqual({type: "file", url: "https://example.com/a.pdf", fileName: "a.pdf", caption: undefined});
		expect(toPayload(payload({type: "file", url: "https://example.com/a.pdf"}))).toBe("url and fileName are required");
		expect(toPayload(payload({type: "file", fileName: "a.pdf"}))).toBe("url and fileName are required");
	});

	it("location needs numeric coordinates", () => {
		expect(toPayload(payload({type: "location", latitude: 51.5, longitude: -0.12}))).toMatchObject({type: "location", latitude: 51.5, longitude: -0.12});
		expect(toPayload(payload({type: "location", latitude: "51.5", longitude: -0.12}))).toBe("latitude and longitude are required");
		expect(toPayload(payload({type: "location", latitude: 51.5}))).toBe("latitude and longitude are required");
	});

	it("contact needs a phone with digits", () => {
		expect(toPayload(payload({type: "contact", phone: "+1 212 555 0123", firstName: "Ann"}))).toMatchObject({type: "contact", phone: "+1 212 555 0123", firstName: "Ann"});
		expect(toPayload(payload({type: "contact", phone: "n/a"}))).toBe("phone is required");
	});

	it("poll needs a question and two options, multipleAnswers defaults to false", () => {
		expect(toPayload(payload({type: "poll", question: "Tea?", options: ["yes", "no"]}))).toEqual({type: "poll", question: "Tea?", options: ["yes", "no"], multipleAnswers: false});
		expect(toPayload(payload({type: "poll", question: "Tea?", options: ["yes"]}))).toBe("question and at least two options are required");
		expect(toPayload(payload({type: "poll", options: ["yes", "no"]}))).toBe("question and at least two options are required");
	});

	it("buttons: body and at least one button", () => {
		expect(toPayload(payload({type: "buttons", body: "Pick", buttons: []}))).toBe("body and at least one button are required");
		expect(toPayload(payload({type: "buttons", buttons: [{type: "reply", text: "A"}]}))).toBe("body and at least one button are required");
	});

	it("buttons: reply buttons cannot be mixed with action buttons", () => {
		const mixed = payload({type: "buttons", body: "Pick", buttons: [{type: "reply", text: "A"}, {type: "url", text: "Site", value: "https://example.com"}]});
		expect(toPayload(mixed)).toBe("reply buttons cannot be mixed with copy/call/url buttons");
	});

	it("buttons: action buttons need a value, reply buttons do not", () => {
		expect(toPayload(payload({type: "buttons", body: "Pick", buttons: [{type: "url", text: "Site"}]}))).toBe("copy/call/url buttons need a value");
		expect(toPayload(payload({type: "buttons", body: "Pick", buttons: [{type: "reply", text: "A"}, {type: "reply", text: "B"}]}))).toEqual({
			type: "buttons",
			header: undefined,
			body: "Pick",
			footer: undefined,
			buttons: [{type: "reply", text: "A", value: undefined}, {type: "reply", text: "B", value: undefined}],
		});
	});
});

describe("CreateJobDto shape validation", () => {
	it("accepts a minimal valid job", async () => {
		expect(await violations({idInstance: 1101000001, items: [item]})).toEqual([]);
	});

	it("rejects a missing or non-positive idInstance", async () => {
		expect(await violations({items: [item]})).toEqual(["idInstance"]);
		expect(await violations({idInstance: 0, items: [item]})).toEqual(["idInstance"]);
	});

	it("rejects an empty items array", async () => {
		expect(await violations({idInstance: 1, items: []})).toEqual(["items"]);
	});

	it("rejects malformed record ids and unknown payload types", async () => {
		expect(await violations({idInstance: 1, items: [{...item, recordId: "rec123"}]})).toEqual(["items.0.recordId"]);
		expect(await violations({idInstance: 1, items: [{...item, payload: {type: "sticker"}}]})).toEqual(["items.0.payload.type"]);
	});

	it("rejects a file url without a scheme", async () => {
		expect(await violations({idInstance: 1, items: [{...item, payload: {type: "file", url: "example.com/a.pdf", fileName: "a.pdf"}}]})).toEqual(["items.0.payload.url"]);
	});

	it("validates the write-back block", async () => {
		expect(await violations({idInstance: 1, items: [item], writeBack: {tableId: "tblAbCdEfGhIjKlMn", statusFieldId: "fldAbCdEfGhIjKlMn", statusFieldType: "singleSelect"}})).toEqual([]);
		expect(await violations({idInstance: 1, items: [item], writeBack: {tableId: "nope", statusFieldType: "checkbox"}})).toEqual(["writeBack.tableId", "writeBack.statusFieldType"]);
	});
});
