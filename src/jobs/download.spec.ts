import { IntegrationError } from "@green-api/greenapi-integration";
import { ErrorCode } from "../errors";
import { downloadPublicUrl } from "./download";

async function codeOf(url: string): Promise<string> {
	try {
		await downloadPublicUrl(url);
	} catch (error) {
		return (error as IntegrationError).code;
	}
	return "NO_ERROR";
}

describe("downloadPublicUrl", () => {
	it.each([
		"http://127.0.0.1/secret",
		"http://169.254.169.254/latest/meta-data",
		"http://10.0.0.5/",
		"http://192.168.1.1/",
		"http://[::1]/",
		"http://[::ffff:127.0.0.1]/",
		"http://localhost:3000/api/v1/instances",
	])("refuses private and loopback addresses: %s", async url => {
		expect(await codeOf(url)).toBe(ErrorCode.FILE_URL_INVALID);
	});

	it("refuses non-http schemes", async () => {
		expect(await codeOf("ftp://example.com/a.pdf")).toBe(ErrorCode.FILE_URL_INVALID);
		expect(await codeOf("file:///etc/passwd")).toBe(ErrorCode.FILE_URL_INVALID);
	});
});
