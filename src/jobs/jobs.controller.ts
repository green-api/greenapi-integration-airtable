import {
	Body,
	Controller,
	DefaultValuePipe,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { CreateJobDto } from "./dto/create-job.dto";
import { PersonalKeyGuard } from "../bases/guards/base-key.guard";
import { AuthReq } from "../types";
import { JOBS_LIST_DEFAULT_LIMIT } from "../defaults";

@Controller("jobs")
@UseGuards(PersonalKeyGuard)
export class JobsController {
	constructor(private readonly jobs: JobsService) {}

	@Post()
	create(@Req() req: AuthReq, @Body() dto: CreateJobDto) {
		return this.jobs.create(req.base, req.user, dto);
	}

	@Get()
	list(@Req() req: AuthReq, @Query("limit", new DefaultValuePipe(JOBS_LIST_DEFAULT_LIMIT), ParseIntPipe) limit: number) {
		return this.jobs.list(req.base.id, limit);
	}

	@Get(":id")
	get(@Req() req: AuthReq, @Param("id") id: string) {
		return this.jobs.get(req.base.id, id);
	}

	@Post(":id/cancel")
	@HttpCode(HttpStatus.OK)
	cancel(@Req() req: AuthReq, @Param("id") id: string) {
		return this.jobs.cancel(req.base.id, id);
	}
}
