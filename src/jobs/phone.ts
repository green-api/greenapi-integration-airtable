import { formatPhoneNumber } from "@green-api/greenapi-integration";
import { Messenger } from "../generated/prisma/client";
import { MAX_PHONE_DIGITS, MIN_PHONE_DIGITS, NUMERIC_CHAT_ID, PHONE_CHAT_ID, WHATSAPP_GROUP_ID } from "../defaults";

export function toChatId(raw: string, messenger: Messenger): string | null {
	const trimmed = raw.trim();
	if (messenger === "whatsapp" ? WHATSAPP_GROUP_ID.test(trimmed) : NUMERIC_CHAT_ID.test(trimmed) || PHONE_CHAT_ID.test(trimmed)) {
		return trimmed;
	}
	const digits = trimmed.replace(/\D/g, "");
	if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
		return null;
	}
	return formatPhoneNumber(digits);
}
