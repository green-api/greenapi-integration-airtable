import { apiError, ErrorCode } from "./errors";
import { GREEN_API_LONG_METHODS, GREEN_API_LONG_TIMEOUT_MS } from "./defaults";

function raceTimeout<T>(call: Promise<T>, ms: number, method: string): Promise<T> {
	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(apiError(ErrorCode.GREEN_API_TIMEOUT, `GREEN-API did not answer ${method} within ${Math.round(ms / 1000)} s`, 504)),
			ms,
		);
	});
	return Promise.race([call, timeout]).finally(() => clearTimeout(timer));
}

export function withTimeouts<T extends object>(client: T, timeoutMs: number): T {
	return new Proxy(client, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value !== "function") {
				return value;
			}
			return (...args: unknown[]) => {
				const result = value.apply(target, args);
				if (!(result instanceof Promise)) {
					return result;
				}
				const ms = GREEN_API_LONG_METHODS.includes(String(prop)) ? Math.max(timeoutMs, GREEN_API_LONG_TIMEOUT_MS) : timeoutMs;
				return raceTimeout(result, ms, String(prop));
			};
		},
	});
}
