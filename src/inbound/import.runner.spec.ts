import { IntegrationError } from "@green-api/greenapi-integration";
import { setTimeout as sleep } from "node:timers/promises";
import { ImportJob } from "../generated/prisma/client";
import { ErrorCode } from "../errors";
import { AIRTABLE_RATE_LIMIT_BACKOFF_MS, IMPORT_CHUNK_SIZE, IMPORT_RATE_LIMIT_RETRIES } from "../defaults";
import { ImportRunner } from "./import.runner";

jest.mock("node:timers/promises", () => ({setTimeout: jest.fn(async () => undefined)}));
jest.mock("../prisma/prisma.service", () => ({PrismaService: class {}}));
jest.mock("./inbound.service", () => ({InboundService: class {}}));

const JOB: ImportJob = {
	id: "imp1",
	baseId: "appTESTBASE0000001",
	idInstance: BigInt(1101000001),
	minutes: 1440,
	status: "queued",
	total: null,
	imported: 0,
	skipped: 0,
	error: null,
	createdAt: new Date(0),
	startedAt: null,
	finishedAt: null,
};

function journal(count: number) {
	return Array.from({length: count}, (_, i) => ({idMessage: `id${i}`, timestamp: count - i}));
}

function setup(items: Array<{ idMessage: string; timestamp: number }>) {
	const update = jest.fn(async () => JOB);
	const updateMany = jest.fn(async () => ({count: 1}));
	const prisma = {getInstance: jest.fn(async () => ({idInstance: JOB.idInstance})), importJob: {update, updateMany}};
	const importItems = jest.fn(async (_target: unknown, chunk: unknown[]) => ({imported: chunk.length, skipped: 0}));
	const fetchHistory = jest.fn(async () => items);
	const inbound = {targetFor: jest.fn(async () => ({baseId: JOB.baseId})), fetchHistory, importItems};
	const runner = new ImportRunner(prisma as never, inbound as never);
	const run = (runner as unknown as { run(job: ImportJob): Promise<void> }).run.bind(runner);
	return {run, update, updateMany, importItems, fetchHistory};
}

const rateLimited = () => new IntegrationError("Airtable rate limit hit", ErrorCode.AIRTABLE_RATE_LIMITED, 429);

beforeEach(() => jest.mocked(sleep).mockClear());

describe("ImportRunner", () => {
	it("imports the journal oldest first in chunks and records progress", async () => {
		const {run, update, updateMany, importItems} = setup(journal(IMPORT_CHUNK_SIZE + 5));
		await run(JOB);
		expect(importItems).toHaveBeenCalledTimes(2);
		const first = importItems.mock.calls[0][1] as Array<{ timestamp: number }>;
		expect(first).toHaveLength(IMPORT_CHUNK_SIZE);
		expect(first[0].timestamp).toBe(1);
		expect(update).toHaveBeenCalledWith({where: {id: JOB.id}, data: {total: IMPORT_CHUNK_SIZE + 5}});
		expect(update).toHaveBeenCalledWith({where: {id: JOB.id}, data: {imported: {increment: 5}, skipped: {increment: 0}}});
		expect(updateMany).toHaveBeenCalledWith({where: {id: JOB.id}, data: expect.objectContaining({status: "done"})});
	});

	it("waits and retries a chunk when Airtable rate-limits it", async () => {
		const {run, updateMany, importItems} = setup(journal(3));
		importItems.mockRejectedValueOnce(rateLimited());
		await run(JOB);
		expect(sleep).toHaveBeenCalledWith(AIRTABLE_RATE_LIMIT_BACKOFF_MS);
		expect(importItems).toHaveBeenCalledTimes(2);
		expect(updateMany).toHaveBeenCalledWith({where: {id: JOB.id}, data: expect.objectContaining({status: "done"})});
	});

	it("retries the journal fetch when GREEN-API rate-limits it", async () => {
		const {run, fetchHistory, updateMany} = setup(journal(1));
		fetchHistory.mockRejectedValueOnce(new IntegrationError("slow down", ErrorCode.GREEN_API_RATE_LIMITED, 429));
		await run(JOB);
		expect(fetchHistory).toHaveBeenCalledTimes(2);
		expect(updateMany).toHaveBeenCalledWith({where: {id: JOB.id}, data: expect.objectContaining({status: "done"})});
	});

	it("fails the job after the retries run out", async () => {
		const {run, updateMany, importItems} = setup(journal(1));
		importItems.mockRejectedValue(rateLimited());
		await run(JOB);
		expect(importItems).toHaveBeenCalledTimes(IMPORT_RATE_LIMIT_RETRIES + 1);
		expect(updateMany).toHaveBeenCalledWith({where: {id: JOB.id}, data: expect.objectContaining({status: "failed", error: "Airtable rate limit hit"})});
	});

	it("fails the job at once on other errors", async () => {
		const {run, updateMany, fetchHistory} = setup([]);
		fetchHistory.mockRejectedValueOnce(new IntegrationError("GREEN-API error: boom", ErrorCode.GREEN_API_ERROR, 502));
		await run(JOB);
		expect(sleep).not.toHaveBeenCalled();
		expect(updateMany).toHaveBeenCalledWith({where: {id: JOB.id}, data: expect.objectContaining({status: "failed", error: "GREEN-API error: boom"})});
	});
});
