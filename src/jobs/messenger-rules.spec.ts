import { messengerProblem } from "./messenger-rules";

const buttons = {type: "buttons" as const, body: "Pick", buttons: [{type: "reply" as const, text: "A"}]};

describe("messengerProblem", () => {
	it("allows buttons only on WhatsApp", () => {
		expect(messengerProblem(buttons, "whatsapp", "12125550123@c.us")).toBeNull();
		expect(messengerProblem(buttons, "telegram", "7203921144")).toBe("buttons are not supported on telegram");
		expect(messengerProblem(buttons, "max", "16976233")).toBe("buttons are not supported on max");
	});

	it("applies the messenger's text limit", () => {
		expect(messengerProblem({type: "text", text: "x".repeat(4096)}, "telegram", "7203921144")).toBeNull();
		expect(messengerProblem({type: "text", text: "x".repeat(4097)}, "telegram", "7203921144")).toBe("text exceeds 4096 characters");
		expect(messengerProblem({type: "text", text: "x".repeat(4001)}, "max", "16976233")).toBe("text exceeds 4000 characters");
		expect(messengerProblem({type: "text", text: "x".repeat(4001)}, "whatsapp", "12125550123@c.us")).toBeNull();
	});

	it("sends Telegram polls only to groups", () => {
		const poll = {type: "poll" as const, question: "Tea?", options: ["y", "n"], multipleAnswers: false};
		expect(messengerProblem(poll, "telegram", "7203921144")).toBe("polls go only to groups on telegram");
		expect(messengerProblem(poll, "telegram", "-1001234567890")).toBeNull();
		expect(messengerProblem(poll, "max", "16976233")).toBeNull();
		expect(messengerProblem(poll, "whatsapp", "12125550123@c.us")).toBeNull();
	});

	it("leaves the other types alone", () => {
		expect(messengerProblem({type: "location", latitude: 1, longitude: 2}, "telegram", "7203921144")).toBeNull();
	});
});
