import { INSTANCE_TOKEN_IN_PATH } from "./defaults";

export function redactSecrets(text: string): string {
	return text.replace(INSTANCE_TOKEN_IN_PATH, "$1***");
}
