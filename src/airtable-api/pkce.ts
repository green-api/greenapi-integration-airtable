import { createHash, randomBytes } from "crypto";

export function createCodeVerifier(): string {
	return randomBytes(48).toString("base64url");
}

export function codeChallenge(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

export function createState(): string {
	return randomBytes(24).toString("base64url");
}
