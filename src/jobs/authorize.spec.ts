import { IntegrationError } from "@green-api/greenapi-integration";
import { ErrorCode } from "../errors";
import { UserWithInstances } from "../types";
import { assertCanSend } from "./authorize";

const SALES = 1101000001;
const SUPPORT = 1101000002;

function user(permissionLevel: UserWithInstances["permissionLevel"], idInstances: number[]): UserWithInstances {
	return {
		id: "usr_1",
		baseId: "appTESTBASE0000001",
		airtableUserId: "usrAIRTABLE000001",
		email: "someone@example.com",
		name: "Someone",
		permissionLevel,
		keyHash: null,
		createdAt: new Date(0),
		lastSeenAt: new Date(0),
		instances: idInstances.map(idInstance => ({userId: "usr_1", idInstance: BigInt(idInstance)})),
	};
}

function codeOf(fn: () => void): string {
	try {
		fn();
	} catch (error) {
		return (error as IntegrationError).code;
	}
	return "NO_ERROR";
}

describe("assertCanSend", () => {
	it("lets an owner with no explicit list use any instance", () => {
		expect(() => assertCanSend(user("create", []), SALES)).not.toThrow();
	});

	it("refuses an editor nobody assigned an instance to", () => {
		expect(codeOf(() => assertCanSend(user("edit", []), SALES))).toBe(ErrorCode.INSTANCE_NOT_ASSIGNED);
	});

	it("allows an assigned instance and refuses the others", () => {
		const editor = user("edit", [SALES]);
		expect(() => assertCanSend(editor, SALES)).not.toThrow();
		expect(codeOf(() => assertCanSend(editor, SUPPORT))).toBe(ErrorCode.INSTANCE_FORBIDDEN);
	});

	it("never restricts an owner, even if a stale list exists", () => {
		expect(() => assertCanSend(user("create", [SUPPORT]), SALES)).not.toThrow();
	});

	it("answers with 403 in both refusal cases", () => {
		const statuses = [
			(() => { try { assertCanSend(user("edit", []), SALES); } catch (e) { return (e as IntegrationError).statusCode; } })(),
			(() => { try { assertCanSend(user("edit", [SALES]), SUPPORT); } catch (e) { return (e as IntegrationError).statusCode; } })(),
		];
		expect(statuses).toEqual([403, 403]);
	});
});
