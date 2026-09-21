import axios from "axios";
import { BlockList, isIP } from "net";
import { lookup } from "dns/promises";
import { apiError, ErrorCode } from "../errors";
import { DOWNLOAD_MAX_REDIRECTS, MAX_UPLOAD_BYTES, UPLOAD_DOWNLOAD_TIMEOUT_MS } from "../defaults";

const PRIVATE_RANGES = new BlockList();
PRIVATE_RANGES.addSubnet("0.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_RANGES.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_RANGES.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_RANGES.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_RANGES.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_RANGES.addSubnet("224.0.0.0", 3, "ipv4");
PRIVATE_RANGES.addSubnet("::", 128, "ipv6");
PRIVATE_RANGES.addSubnet("::1", 128, "ipv6");
PRIVATE_RANGES.addSubnet("fc00::", 7, "ipv6");
PRIVATE_RANGES.addSubnet("fe80::", 10, "ipv6");

export interface Download {
	data: ArrayBuffer;
	contentType: string | undefined;
}

async function assertPublic(url: URL): Promise<void> {
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw apiError(ErrorCode.FILE_URL_INVALID, `Only http(s) file links can be sent, got ${url.protocol}`, 400);
	}
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host) ? [{address: host, family: isIP(host)}] : await lookup(host, {all: true});
	for (const {address, family} of addresses) {
		if (PRIVATE_RANGES.check(address, family === 6 ? "ipv6" : "ipv4")) {
			throw apiError(ErrorCode.FILE_URL_INVALID, `The file link points at a private network address (${url.hostname})`, 400);
		}
	}
}

export async function downloadPublicUrl(url: string): Promise<Download> {
	let current = new URL(url);
	for (let hop = 0; hop <= DOWNLOAD_MAX_REDIRECTS; hop++) {
		await assertPublic(current);
		const response = await axios.get<ArrayBuffer>(current.toString(), {
			responseType: "arraybuffer",
			maxContentLength: MAX_UPLOAD_BYTES,
			timeout: UPLOAD_DOWNLOAD_TIMEOUT_MS,
			maxRedirects: 0,
			validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400),
		});
		const location = response.headers.location;
		if (response.status < 300 || typeof location !== "string") {
			const contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : undefined;
			return {data: response.data, contentType};
		}
		current = new URL(location, current);
	}
	throw apiError(ErrorCode.FILE_URL_INVALID, "The file link redirects too many times", 400);
}
