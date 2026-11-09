import { ImportJob } from "../generated/prisma/client";
import { ImportJobView } from "../types";

export function toImportJobView(job: ImportJob): ImportJobView {
	return {
		id: job.id,
		idInstance: Number(job.idInstance),
		minutes: job.minutes,
		status: job.status,
		total: job.total,
		imported: job.imported,
		skipped: job.skipped,
		error: job.error,
		createdAt: job.createdAt.toISOString(),
		finishedAt: job.finishedAt?.toISOString() ?? null,
	};
}
