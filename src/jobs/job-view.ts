import { SendJob, SendJobItem } from "../generated/prisma/client";
import { SendJobItemView, SendJobSummaryView, SendJobView } from "../types";

export function toJobSummaryView(job: SendJob): SendJobSummaryView {
	return {
		id: job.id,
		idInstance: Number(job.idInstance),
		status: job.status,
		total: job.total,
		sent: job.sent,
		failed: job.failed,
		createdAt: job.createdAt.toISOString(),
		finishedAt: job.finishedAt?.toISOString() ?? null,
	};
}

export function toJobItemView(item: SendJobItem): SendJobItemView {
	return {
		recordId: item.recordId,
		chatId: item.chatId,
		status: item.status,
		idMessage: item.idMessage,
		error: item.error,
	};
}

export function toJobView(job: SendJob & { items: SendJobItem[] }): SendJobView {
	return {...toJobSummaryView(job), items: job.items.map(toJobItemView)};
}
