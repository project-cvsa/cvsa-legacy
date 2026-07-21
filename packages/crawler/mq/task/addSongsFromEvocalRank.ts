import { sql } from "@core/db/dbNew";
import logger from "@core/log";
import { LatestVideosQueue } from "mq/index";

const LATEST_RANK_URL = "https://www.evocalrank.com/data/info/latest.json";
const RANK_DATA_URL = "https://www.evocalrank.com/data/rank_data";
const RANK_COUNT = 5;
const IMPORT_UID = "gFPFCxuvDSo481xv";

type RankItem = {
	avid?: unknown;
};

type RankData = {
	ranknum?: unknown;
	main_rank?: RankItem[];
	second_rank?: RankItem[];
	super_hit?: RankItem[];
	pick_up?: RankItem[];
	Vocaloid_pick_up?: RankItem[];
	ed?: RankItem[];
	op?: RankItem[];
};

async function fetchJSON<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}
	return (await response.json()) as T;
}

function addAidsFromRankData(aids: Set<number>, data: RankData) {
	const ranks = [
		data.main_rank,
		data.second_rank,
		data.super_hit,
		data.pick_up,
		data.Vocaloid_pick_up,
		data.ed,
		data.op,
	];

	for (const rank of ranks) {
		for (const item of rank ?? []) {
			if (typeof item.avid !== "string") continue;
			const match = item.avid.match(/^av(\d+)$/i) ?? item.avid.match(/^(\d+)$/);
			if (!match) continue;
			const aid = Number.parseInt(match[1], 10);
			if (Number.isSafeInteger(aid) && aid > 0) {
				aids.add(aid);
			}
		}
	}
}

async function getCurrentRankNumber() {
	const latest = await fetchJSON<RankData>(LATEST_RANK_URL);
	if (typeof latest.ranknum !== "number" || !Number.isInteger(latest.ranknum)) {
		throw new Error("EvocalRank latest.json does not contain a valid ranknum.");
	}
	return latest.ranknum;
}

async function collectRecentAids(ranknum: number) {
	const aids = new Set<number>();
	for (let rank = ranknum; rank > ranknum - RANK_COUNT; rank -= 1) {
		const data = await fetchJSON<RankData>(`${RANK_DATA_URL}/${rank}.json`);
		addAidsFromRankData(aids, data);
	}
	return aids;
}

async function findMissingAids(aids: Set<number>) {
	if (aids.size === 0) return [];

	const rows = await sql<{ aid: number }[]>`
		SELECT v.aid
		FROM UNNEST(${[...aids]}::bigint[]) AS v(aid)
		EXCEPT
		SELECT aid FROM bilibili_metadata
	`;
	return rows.map((row) => row.aid);
}

export async function addSongsFromEvocalRank() {
	const ranknum = await getCurrentRankNumber();
	const aids = await collectRecentAids(ranknum);
	const missingAids = await findMissingAids(aids);

	if (missingAids.length === 0) {
		logger.log(`EvocalRank ${ranknum}: no missing videos found.`, "mq");
		return;
	}

	await LatestVideosQueue.addBulk(
		missingAids.map((aid) => ({
			name: "getVideoInfo",
			data: {
				aid,
				insertSongs: true,
				uid: IMPORT_UID,
			},
		}))
	);

	logger.log(
		`EvocalRank ${ranknum}: queued ${missingAids.length} missing videos from the latest ${RANK_COUNT} ranks.`,
		"mq"
	);
}
