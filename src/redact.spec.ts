import { redactSecrets } from "./redact";

describe("redactSecrets", () => {
	it("hides the instance token inside GREEN-API paths", () => {
		const text = 'Request failed with status code 400. {"path":"/waInstance1101000001/sendLocation/fb9b261050e542b2bafbd4862a87151f7fe66758ff664ab5a2","message":"x"}';
		expect(redactSecrets(text)).toBe('Request failed with status code 400. {"path":"/waInstance1101000001/sendLocation/***","message":"x"}');
	});

	it("leaves other text alone", () => {
		expect(redactSecrets("connect ECONNREFUSED 1.2.3.4:443")).toBe("connect ECONNREFUSED 1.2.3.4:443");
	});
});
