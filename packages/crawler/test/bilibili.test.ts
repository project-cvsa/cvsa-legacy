import { describe, expect, test } from "bun:test";
import { getVideoInfo } from "@core/net/getVideoInfo";
import { bulkGetVideoStats } from "net/bulkGetVideoStats";
import networkDelegate from "@core/net/delegate";

describe("Bilibili API", () => {
	test("bulkGetVideoStats()", async () => {
		const res = await networkDelegate.request("https://example.com", "getVideoInfo");
		expect(res).toBeObject();
	});
});
