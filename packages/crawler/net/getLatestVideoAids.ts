import logger from "@core/log";
import type { NewListRankResponse } from "@core/net/bilibili.d";
import networkDelegate from "@core/net/delegate";

export async function getLatestVideoAids(
	page: number = 1,
	pageSize: number = 100,
	timeFrom: string,
	timeTo: string
): Promise<{ aids: number[]; numPages: number; numResults: number }> {
	const errMessage = `Error fetching latest aids for time range ${timeFrom}-${timeTo} page ${page}:`;
	const url = `https://api.bilibili.com/x/web-interface/newlist_rank?cate_id=30&pagesize=${pageSize}&time_from=${timeFrom}&time_to=${timeTo}&search_type=video&view_type=hot_rank&page=${page}`;
	const { data } = await networkDelegate.request<NewListRankResponse>(url, "getLatestVideos");
	if (data.code !== 0) {
		logger.error(errMessage + data.message, "net", "getLatestVideos");
		return { aids: [], numPages: 0, numResults: 0 };
	}
	if (!data.data.result || data.data.result.length === 0) {
		logger.verbose("No more videos found", "net", "getLatestVideos");
		return { aids: [], numPages: data.data.numPages, numResults: data.data.numResults };
	}
	return {
		aids: data.data.result.map((video) => video.id),
		numPages: data.data.numPages,
		numResults: data.data.numResults,
	};
}