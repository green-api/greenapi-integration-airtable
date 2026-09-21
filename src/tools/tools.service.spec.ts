import { IntegrationError } from "@green-api/greenapi-integration";
import { Instance, Messenger } from "../generated/prisma/client";
import { ErrorCode } from "../errors";
import { ToolsService } from "./tools.service";

jest.mock("../airtable/airtable.adapter", () => ({AirtableAdapter: class {}}));
jest.mock("../inbound/inbound.service", () => ({InboundService: class {}}));

function instance(messenger: Messenger): Instance {
	return {
		idInstance: BigInt(1101000001),
		apiTokenInstance: "token",
		apiUrl: "https://api.green-api.com",
		stateInstance: "authorized",
		messenger,
		phone: null,
		checkedAt: null,
		settings: null,
		name: null,
		receiveWebhooks: false,
		baseId: "appTESTBASE0000001",
		createdAt: new Date(0),
	};
}

function setup(account: { exist: boolean; chatId?: string }) {
	const checkAccount = jest.fn(async () => account);
	const importChat = jest.fn(async () => ({imported: 0, skipped: 0}));
	const service = new ToolsService({createGreenApiClient: () => ({checkAccount})} as never, {importChat} as never);
	return {service, checkAccount, importChat};
}

describe("ToolsService.importChat", () => {
	it("passes WhatsApp phones straight through as chat ids", async () => {
		const {service, checkAccount, importChat} = setup({exist: true, chatId: "999"});
		await service.importChat(instance("whatsapp"), "+1 212 555-0123", 50);
		expect(checkAccount).not.toHaveBeenCalled();
		expect(importChat).toHaveBeenCalledWith(expect.anything(), "12125550123@c.us", 50);
	});

	it("resolves Telegram and MAX phones to the numeric chat id", async () => {
		const {service, checkAccount, importChat} = setup({exist: true, chatId: "16976233"});
		await service.importChat(instance("max"), "+1 212 555-0123", undefined);
		expect(checkAccount).toHaveBeenCalledWith({phoneNumber: 12125550123});
		expect(importChat).toHaveBeenCalledWith(expect.anything(), "16976233", 100);
	});

	it("uses a numeric chat id as-is on Telegram and MAX", async () => {
		const {service, checkAccount, importChat} = setup({exist: true, chatId: "999"});
		await service.importChat(instance("telegram"), "7203921144", 20);
		expect(checkAccount).not.toHaveBeenCalled();
		expect(importChat).toHaveBeenCalledWith(expect.anything(), "7203921144", 20);
	});

	it("reports a phone without an account", async () => {
		const {service, importChat} = setup({exist: false});
		await expect(service.importChat(instance("telegram"), "+1 212 555-0123", 20)).rejects.toMatchObject({code: ErrorCode.RECIPIENT_NOT_FOUND} as Partial<IntegrationError>);
		expect(importChat).not.toHaveBeenCalled();
	});

	it("rejects values that are neither a phone nor a chat id", async () => {
		const {service, checkAccount} = setup({exist: true});
		await expect(service.importChat(instance("max"), "hello", 20)).rejects.toMatchObject({code: ErrorCode.PHONE_INVALID} as Partial<IntegrationError>);
		expect(checkAccount).not.toHaveBeenCalled();
	});
});
