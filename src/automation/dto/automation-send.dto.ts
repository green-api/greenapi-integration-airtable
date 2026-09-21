import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from "class-validator";
import { JobWriteBackDto, PayloadDto } from "../../jobs/dto/create-job.dto";

export class AutomationSendDto {
	@IsInt()
	@Min(1)
	idInstance: number;

	@IsString()
	@MaxLength(64)
	phone: string;

	@ValidateNested()
	@Type(() => PayloadDto)
	payload: PayloadDto;

	@IsOptional()
	@IsString()
	@Matches(/^rec[A-Za-z0-9]{14}$/)
	recordId?: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => JobWriteBackDto)
	writeBack?: JobWriteBackDto;
}
