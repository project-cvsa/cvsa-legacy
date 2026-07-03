import { LatestVideosQueue } from "@crawler/mq";
import { sql } from "@core/db/dbNew";

const aids = new Set<string>();
const f = Bun.file("temp/evocalrank.json");

const parsed = await f.json() as string[];
parsed.forEach(item => aids.add(item));

async function findMissingIds(idSet: Set<string> | string[]) {
    const ids = Array.from(idSet);
    if (ids.length === 0) return [];

    const aids = ids.map(id => parseInt(id.slice(2)));
  
    const missingIds = await sql<{ id: number }[]>`
        SELECT v.id FROM UNNEST(${aids}::bigint[]) AS v(id)
        EXCEPT
        SELECT aid FROM bilibili_metadata
    `;
  
    return missingIds.map(row => row.id); 
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
console.log("start findMissingIds")
const missingIds = await findMissingIds(aids);
console.log("missing IDs: ", missingIds.length)
for (const aid of missingIds) {
    const job = await LatestVideosQueue.add("getVideoInfo", {
        aid: aid,
        insertSongs: true,
        uid: "gFPFCxuvDSo481xv",
    });
    if (!job.id) {
        console.warn("failed to insert video:", aid);
        continue;
    }
    console.log("video insertion requested:", aid);
    await sleep(300);
}
process.exit(0);