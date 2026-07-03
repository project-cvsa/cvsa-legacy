import { SECOND } from "@core/lib";
import logger from "@core/log";
import { videoExistsInAllData } from "db/bilibili_metadata";
import { LatestVideosQueue } from "mq/index";
import { getLatestVideoAids } from "net/getLatestVideoAids";
import { sleep } from "utils/sleep";

function formatDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

export async function queueLatestVideos(): Promise<number | null> {
	const timeTo = formatDateString(new Date());
	const timeFromDate = new Date();
	timeFromDate.setDate(timeFromDate.getDate() - 3);
	const timeFrom = formatDateString(timeFromDate);

	const pageSize = 50;
	let page = 1;
	let numPages = 1;
	let i = 0;
	const videosFound = new Set();
	while (page <= numPages) {
		const { aids, numPages: np, numResults } = await getLatestVideoAids(
			page,
			pageSize,
			timeFrom,
			timeTo
		);
		if (page === 1) {
			numPages = np;
			logger.log(
				`Time range ${timeFrom}-${timeTo}: ${numResults} videos across ${numPages} pages.`,
				"net",
				"fn:queueLatestVideos()"
			);
		}
		if (aids.length === 0) {
			logger.verbose("No more videos found", "net", "fn:queueLatestVideos()");
			break;
		}
		let delay = 0;
		for (const aid of aids) {
			const videoExists = await videoExistsInAllData(aid);
			if (videoExists) {
				continue;
			}
			await LatestVideosQueue.add(
				"getVideoInfo",
				{ aid },
				{
					attempts: 100,
					backoff: {
						delay: SECOND * 5,
						type: "fixed",
					},
					delay,
				}
			);
			videosFound.add(aid);
			delay += Math.random() * SECOND * 1.5;
		}
		i += aids.length;
		logger.log(
			`Page ${page}/${numPages} crawled, total: ${videosFound.size}/${i} videos added/observed.`,
			"net",
			"fn:queueLatestVideos()"
		);
		page++;
		const randomTime = Math.random() * 4000;
		const delta = SECOND;
		await sleep(randomTime + delta);
	}
	return 0;
}