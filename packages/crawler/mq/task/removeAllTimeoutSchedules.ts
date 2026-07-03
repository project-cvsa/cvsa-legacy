import { sql } from "@core/db/dbNew";

export async function removeAllTimeoutSchedules() {
	return sql`
		WITH deleted AS (
			DELETE FROM snapshot_schedule
			WHERE status IN ('pending', 'processing')
			AND started_at < NOW() - INTERVAL '2 minute'
			RETURNING *
		) 
		SELECT count(*) FROM deleted;
	`;
}


export async function removeOldSchedules() {
	return sql`
		WITH deleted AS (DELETE
			FROM snapshot_schedule
			WHERE status = 'completed' or status = 'failed' or status = 'bili_error' or status = 'no_proxy'
			AND started_at < NOW() - INTERVAL '5 days'
			RETURNING *
		)
		SELECT count(*) FROM deleted;
	`;
}
