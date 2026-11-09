import { IntegrationError } from "@green-api/greenapi-integration";
import { Instance, Messenger } from "../generated/prisma/client";
import { ErrorCode } from "../errors";
import { ToolsService } from "./tools.service";

jest.mock("../airtable/airtable.adapter", () => ({AirtableAdapter: class {}}));
jest.mock("../inbound/inbound.service", () => ({InboundService: class {}}));
jest.mock("../inbound/import.runner", () => ({ImportRunner: class {}}));
jest.mock("../prisma/prisma.service", () => ({PrismaService: class {}}));

function instance(messenger: Messenger): Instance {
	return {
		idInstance: BigInt(1101000001),
		apiTokenInstance: "token",
		apiUrl: "https://api.green-api.com",
		stateInstance: "authorized",
		messenger,
		phone: null,
		checkedAt: null,
		reachable: true,
		settings: null,
		name: null,
		receiveWebhooks: false,
		baseId: "appTESTBASE0000001",
		createdAt: new Date(0),
	};
}

function setup(account: { exist: boolean; chatId?: string }, activeImport: object | null = null) {
	const checkAccount = jest.fn(async () => account);
	const importChat = jest.fn(async () => ({imported: 0, skipped: 0}));
	const targetFor = jest.fn(async () => ({}));
	const findFirst = jest.fn(async () => activeImport);
	const create = jest.fn(async ({data}: { data: { baseId: string; idInstance: bigint; minutes: number } }) => ({
		id: "imp1", status: "queued", total: null, imported: 0, skipped: 0, error: null, createdAt: new Date(0), startedAt: null, finishedAt: null, ...data,
	}));
	const kick = jest.fn();
	const service = new ToolsService(
		{createGreenApiClient: () => ({checkAccount})} as never,
		{importJob: {findFirst, create}} as never,
		{importChat, targetFor} as never,
		{kick} as never,
	);
	return {service, checkAccount, importChat, targetFor, create, kick};
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

describe("ToolsService.startImport", () => {
	it("queues an import and starts the worker", async () => {
		const {service, create, kick} = setup({exist: true});
		const view = await service.startImport(instance("telegram"), 1440);
		expect(create).toHaveBeenCalledWith({data: {baseId: "appTESTBASE0000001", idInstance: BigInt(1101000001), minutes: 1440}});
		expect(kick).toHaveBeenCalledWith(BigInt(1101000001));
		expect(view).toMatchObject({id: "imp1", idInstance: 1101000001, minutes: 1440, status: "queued", imported: 0, skipped: 0});
	});

	it("refuses a second import while one is running", async () => {
		const {service, create, kick} = setup({exist: true}, {id: "imp0", status: "running"});
		await expect(service.startImport(instance("whatsapp"), 60)).rejects.toMatchObject({code: ErrorCode.IMPORT_RUNNING} as Partial<IntegrationError>);
		expect(create).not.toHaveBeenCalled();
		expect(kick).not.toHaveBeenCalled();
	});

	it("does not queue anything when receiving is not set up", async () => {
		const {service, targetFor, create} = setup({exist: true});
		targetFor.mockRejectedValueOnce(new IntegrationError("no table", ErrorCode.INBOUND_NOT_CONFIGURED, 409));
		await expect(service.startImport(instance("max"), 60)).rejects.toMatchObject({code: ErrorCode.INBOUND_NOT_CONFIGURED} as Partial<IntegrationError>);
		expect(create).not.toHaveBeenCalled();
	});
});
