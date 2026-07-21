import type { Job } from "bullmq";
import { addSongsFromEvocalRank } from "mq/task/addSongsFromEvocalRank";

export const addSongsFromEvocalRankWorker = async (_job: Job): Promise<void> => {
	await addSongsFromEvocalRank();
};
