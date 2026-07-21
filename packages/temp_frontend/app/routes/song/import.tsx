import type { App } from "@backend/src";
import { treaty } from "@elysiajs/eden";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Title } from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const app = treaty<App>(import.meta.env.VITE_API_URL || "");

export default function BatchSongImport() {
	const [text, setText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [missingIDs, setMissingIDs] = useState<number[] | null>(null);
	const [error, setError] = useState("");

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);
		setError("");
		setMissingIDs(null);

		try {
			const { data, error: responseError } = await app.song.import.bilibili.batch.post(
				{ text },
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem("sessionID") || ""}`,
					},
				}
			);
			if (responseError || !data) {
				setError(responseError?.value?.message || "收录失败");
				return;
			}
			setMissingIDs(data.missingIDs);
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
							已提交 {missingIDs.length} 个缺失视频：
							{missingIDs.length > 0 ? ` ${missingIDs.join(", ")}` : " 无"}
						</p>
					)}
				</CardContent>
			</Card>
		</Layout>
	);
}
