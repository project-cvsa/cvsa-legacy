import { biliIDOrAIDToAID } from "@backend/lib/bilibiliID";
import { LatestVideosQueue } from "@backend/lib/mq";
import requireAuth from "@backend/middlewares/auth";
import { bilibiliMetadata, db } from "@core/drizzle";
import { inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const batchAddSongHandler = new Elysia().use(requireAuth).post(
	"/song/import/bilibili/batch",
	async ({ body, status, user }) => {
		if (user?.role !== "OWNER") {
			return status(403, { message: "Only OWNER users can batch import videos." });
		}

		const ids = body.text
			.split(/\r?\n/)
			.map((id) => id.trim())
			.filter(Boolean);
		const aids = [...new Set(ids.map(biliIDOrAIDToAID))];
		const invalidIDs = ids.filter((id) => biliIDOrAIDToAID(id) === null);

		if (invalidIDs.length > 0) {
			return status(400, {
				message: "Some video IDs could not be parsed.",
				invalidIDs: [...new Set(invalidIDs)],
			});
		}

		const validAids = aids.filter((aid): aid is number => aid !== null);
		if (validAids.length === 0) {
			return status(400, {
				message: "At least one video ID is required.",
				invalidIDs: [],
			});
		}

		const existingVideos = await db
			.select({ aid: bilibiliMetadata.aid })
			.from(bilibiliMetadata)
			.where(inArray(bilibiliMetadata.aid, validAids));
		const existingAids = new Set(existingVideos.map(({ aid }) => aid));
		const missingIDs = validAids.filter((aid) => !existingAids.has(aid));

		for (const aid of missingIDs) {
			const job = await LatestVideosQueue.add("getVideoInfo", {
				aid,
				insertSongs: true,
				uid: user.unqId,
			});
			if (!job.id) {
				console.warn("failed to insert video:", aid);
			}
			await sleep(300);
		}

		return {
			missingIDs,
			queuedCount: missingIDs.length,
		};
	},
	{
		body: t.Object({
			text: t.String(),
		}),
		response: {
			200: t.Object({
				missingIDs: t.Array(t.Integer()),
				queuedCount: t.Integer(),
			}),
			400: t.Object({
				message: t.String(),
				invalidIDs: t.Array(t.String()),
			}),
			401: t.Object({ message: t.String() }),
			403: t.Object({ message: t.String() }),
		},
		detail: {
			summary: "Batch import videos from Bilibili IDs",
			description:
				"Accepts a newline-separated list of av IDs, BV IDs, or bare AIDs. OWNER users can use it to find videos missing from bilibili_metadata and enqueue song import jobs for them.",
		},
	}
);
