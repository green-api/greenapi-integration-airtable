import { toChatId } from "./phone";

describe("toChatId on WhatsApp", () => {
	it("keeps only digits and appends the private chat suffix", () => {
		expect(toChatId("+1 (212) 555-0123", "whatsapp")).toBe("12125550123@c.us");
		expect(toChatId("  1.212.555.0123  ", "whatsapp")).toBe("12125550123@c.us");
		expect(toChatId("12125550123@c.us", "whatsapp")).toBe("12125550123@c.us");
	});

	it("passes group ids through untouched", () => {
		expect(toChatId("120363012345678901@g.us", "whatsapp")).toBe("120363012345678901@g.us");
		expect(toChatId(" 12125550123-1600000000@g.us ", "whatsapp")).toBe("12125550123-1600000000@g.us");
	});

	it("rejects numbers outside the 7–15 digit range", () => {
		expect(toChatId("123456", "whatsapp")).toBeNull();
		expect(toChatId("1234567", "whatsapp")).toBe("1234567@c.us");
		expect(toChatId("123456789012345", "whatsapp")).toBe("123456789012345@c.us");
		expect(toChatId("1234567890123456", "whatsapp")).toBeNull();
	});

	it("rejects empty and non-numeric input", () => {
		expect(toChatId("", "whatsapp")).toBeNull();
		expect(toChatId("   ", "whatsapp")).toBeNull();
		expect(toChatId("call me maybe", "whatsapp")).toBeNull();
	});

	it("does not treat a negative number as a group", () => {
		expect(toChatId("-10000000000000", "whatsapp")).toBe("10000000000000@c.us");
	});
});

describe.each(["telegram", "max"] as const)("toChatId on %s", messenger => {
	it("treats bare digits as a chat id and a leading minus as a group", () => {
		expect(toChatId("10000000", messenger)).toBe("10000000");
		expect(toChatId(" -10000000000000 ", messenger)).toBe("-10000000000000");
	});

	it("keeps phone-style ids and normalises formatted phones", () => {
		expect(toChatId("12125550123@c.us", messenger)).toBe("12125550123@c.us");
		expect(toChatId("+1 (212) 555-0123", messenger)).toBe("12125550123@c.us");
	});

	it("does not accept WhatsApp group ids or junk", () => {
		expect(toChatId("120363012345678901@g.us", messenger)).toBeNull();
		expect(toChatId("call me", messenger)).toBeNull();
	});
});
