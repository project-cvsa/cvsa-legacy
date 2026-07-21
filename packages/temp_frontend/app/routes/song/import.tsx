import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Title } from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const apiURL = import.meta.env.VITE_API_URL || "";

type BatchStreamEvent =
	| { type: "missing"; missingIDs: number[] }
	| { type: "queued"; aid: number; jobID: string }
	| { type: "queue-error"; aid: number; message: string }
	| { type: "complete"; queuedCount: number };

export default function BatchSongImport() {
	const [text, setText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [missingIDs, setMissingIDs] = useState<number[] | null>(null);
	const [queuedCount, setQueuedCount] = useState(0);
	const [queueErrors, setQueueErrors] = useState<number[]>([]);
	const [error, setError] = useState("");

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);
		setError("");
		setMissingIDs(null);
		setQueuedCount(0);
		setQueueErrors([]);

		try {
			const response = await fetch(`${apiURL}/song/import/bilibili/batch`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${localStorage.getItem("sessionID") || ""}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ text }),
			});

			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					message?: string;
				} | null;
				setError(data?.message || "收录失败");
				return;
			}

			if (!response.body) {
				throw new Error("浏览器不支持流式响应");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value, { stream: !done });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) {
					if (!line) continue;
					const event = JSON.parse(line) as BatchStreamEvent;
					switch (event.type) {
						case "missing":
							setMissingIDs(event.missingIDs);
							break;
						case "queued":
							setQueuedCount((count) => count + 1);
							break;
						case "queue-error":
							setQueueErrors((aids) => [...aids, event.aid]);
							break;
						case "complete":
							setQueuedCount(event.queuedCount);
							break;
					}
				}
				if (done) break;
			}
		} catch {
			setError("网络错误，请稍后重试");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Layout>
			<Title title="批量收录视频" />
			<Card className="mx-auto mt-8">
				<CardHeader>
					<CardTitle>批量收录视频</CardTitle>
					<CardDescription>
						每行输入一个 av 号、BV 号或纯数字 AID。仅 OWNER 用户可以操作。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={submit} className="space-y-4">
						<textarea
							className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-64 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
							placeholder={"av1234\nBV1iF411S7Lp\n1234"}
							value={text}
							onChange={(event) => setText(event.target.value)}
						/>
						<Button type="submit" disabled={isSubmitting || !text.trim()}>
							{isSubmitting ? "提交中..." : "收录"}
						</Button>
					</form>

					{error && (
						<p className="mt-4 rounded-md bg-red-100 p-3 text-red-700 dark:bg-red-900 dark:text-red-200">
							{error}
						</p>
					)}
					{missingIDs && (
						<p className="mt-4 rounded-md bg-green-100 p-3 text-green-700 dark:bg-green-900 dark:text-green-200">
							发现 {missingIDs.length} 个缺失视频，已提交 {queuedCount} 个：
							{missingIDs.length > 0 ? ` ${missingIDs.join(", ")}` : " 无"}
							{queueErrors.length > 0 && `（${queueErrors.length} 个提交失败）`}
						</p>
					)}
				</CardContent>
			</Card>
		</Layout>
	);
}
