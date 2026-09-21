import { IntegrationError } from "@green-api/greenapi-integration";
import { apiError, ErrorCode } from "./errors";
import { redactSecrets } from "./redact";

export async function greenApiCall<T>(call: () => Promise<T>): Promise<T> {
	try {
		return await call();
	} catch (error) {
		if (error instanceof IntegrationError && error.code !== "INTEGRATION_ERROR") {
			throw error;
		}
		const status = error instanceof IntegrationError ? error.statusCode : 0;
		const message = redactSecrets(error instanceof Error ? error.message : String(error));
		if (status === 429) {
			throw apiError(ErrorCode.GREEN_API_RATE_LIMITED, "GREEN-API is rate-limiting this instance; wait a minute and try again", 429);
		}
		if (status === 401 || status === 403) {
			throw apiError(ErrorCode.INSTANCE_CREDENTIALS_INVALID, "GREEN-API rejected the instance credentials", 400);
		}
		throw apiError(ErrorCode.GREEN_API_ERROR, `GREEN-API error: ${message}`, 502);
	}
}
