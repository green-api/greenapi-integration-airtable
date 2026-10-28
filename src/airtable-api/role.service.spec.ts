import { RoleService } from "./role.service";
import { ErrorCode } from "../errors";
import { UserWithInstances } from "../types";

jest.mock("./airtable-auth.service", () => ({AirtableAuthService: class {}}));
jest.mock("../prisma/prisma.service", () => ({PrismaService: class {}}));

const HOUR = 60 * 60 * 1000;

function user(permissionLevel: UserWithInstances["permissionLevel"], roleCheckedAt: Date | null): UserWithInstances {
	return {
		id: "usr_1",
		baseId: "appTESTBASE0000001",
		airtableUserId: "usrAIRTABLE000001",
		email: "someone@example.com",
		name: "Someone",
		permissionLevel,
		keyHash: "hash",
		roleCheckedAt,
		createdAt: new Date(0),
		lastSeenAt: new Date(0),
		instances: [],
	};
}

function setup(permission: string) {
	const currentPermission = jest.fn(async () => permission);
	const update = jest.fn(async ({data}: {data: {permissionLevel?: string}}) => ({...user("edit", new Date()), ...data}));
	const transaction = jest.fn(async () => []);
	const prisma = {baseUser: {update}, userAuth: {deleteMany: jest.fn()}, $transaction: transaction};
	const service = new RoleService(prisma as never, {currentPermission} as never);
	return {service, currentPermission, update, transaction};
}

describe("RoleService", () => {
	it("skips the Airtable call when the role was checked within the hour", async () => {
		const {service, currentPermission} = setup("create");
		const fresh = user("edit", new Date());
		expect(await service.current(fresh)).toBe(fresh);
		expect(currentPermission).not.toHaveBeenCalled();
	});

	it("picks up a promotion", async () => {
		const {service, update} = setup("create");
		const result = await service.current(user("edit", new Date(Date.now() - 2 * HOUR)));
		expect(result.permissionLevel).toBe("create");
		expect(update).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({permissionLevel: "create"})}));
	});

	it("picks up a demotion", async () => {
		const {service} = setup("edit");
		const result = await service.current(user("create", null));
		expect(result.permissionLevel).toBe("edit");
	});

	it.each(["lost", "comment", "read", "none"])("revokes the key when access is %s", async permission => {
		const {service, transaction} = setup(permission);
		await expect(service.current(user("create", null))).rejects.toMatchObject({code: ErrorCode.KEY_INVALID, statusCode: 401});
		expect(transaction).toHaveBeenCalled();
	});

	it("keeps the stored role when Airtable does not answer, and waits before asking again", async () => {
		const {service, currentPermission} = setup("unknown");
		const stale = user("edit", null);
		expect(await service.current(stale)).toBe(stale);
		expect(await service.current(stale)).toBe(stale);
		expect(currentPermission).toHaveBeenCalledTimes(1);
	});

	it("runs one check at a time per person", async () => {
		const {service, currentPermission} = setup("edit");
		const stale = user("edit", null);
		await Promise.all([service.current(stale), service.current(stale), service.current(stale)]);
		expect(currentPermission).toHaveBeenCalledTimes(1);
	});
});
