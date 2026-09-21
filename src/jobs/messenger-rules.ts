import { Messenger } from "../generated/prisma/client";
import { BUTTONS_MESSENGERS, GROUP_CHAT_ID, MESSENGER_TEXT_LIMITS, POLL_GROUP_ONLY_MESSENGERS } from "../defaults";
import { OutboundPayload } from "../types";

export function messengerProblem(payload: OutboundPayload, messenger: Messenger, chatId: string): string | null {
	switch (payload.type) {
		case "text": {
			const limit = MESSENGER_TEXT_LIMITS[messenger];
			return payload.text.length > limit ? `text exceeds ${limit} characters` : null;
		}
		case "buttons":
			return BUTTONS_MESSENGERS.includes(messenger) ? null : `buttons are not supported on ${messenger}`;
		case "poll":
			return POLL_GROUP_ONLY_MESSENGERS.includes(messenger) && !GROUP_CHAT_ID.test(chatId) ? `polls go only to groups on ${messenger}` : null;
		default:
			return null;
	}
}
