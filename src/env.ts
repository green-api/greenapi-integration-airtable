import { ConfigService } from "@nestjs/config";

export function requireEnv(config: ConfigService, key: string): string {
	const value = config.get<string>(key)?.trim();
	if (!value) {
		throw new Error(`${key} must be set in the environment`);
	}
	return value;
}
