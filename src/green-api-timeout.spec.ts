import { ErrorCode } from "./errors";
import { withTimeouts } from "./green-api-timeout";

class FakeClient {
	calls = 0;
	getStateInstance(delayMs: number): Promise<string> {
		this.calls++;
		return new Promise(resolve => setTimeout(() => resolve("authorized"), delayMs));
	}
	lastIncomingMessages(delayMs: number): Promise<string> {
		return new Promise(resolve => setTimeout(() => resolve("journal"), delayMs));
	}
	name(): string {
		return "plain";
	}
}

describe("withTimeouts", () => {
	it("passes results through when the call is fast", async () => {
		const client = withTimeouts(new FakeClient(), 200);
		await expect(client.getStateInstance(10)).resolves.toBe("authorized");
		expect(client.calls).toBe(1);
	});

	it("fails a slow call with GREEN_API_TIMEOUT", async () => {
		const client = withTimeouts(new FakeClient(), 50);
		await expect(client.getStateInstance(500)).rejects.toMatchObject({code: ErrorCode.GREEN_API_TIMEOUT, statusCode: 504});
	});

	it("gives journal methods the long limit", async () => {
		const client = withTimeouts(new FakeClient(), 50);
		await expect(client.lastIncomingMessages(150)).resolves.toBe("journal");
	});

	it("leaves non-promise methods alone", () => {
		expect(withTimeouts(new FakeClient(), 50).name()).toBe("plain");
	});
});
