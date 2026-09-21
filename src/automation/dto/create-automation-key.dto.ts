import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { AUTOMATION_KEY_NAME_MAX_LENGTH } from "../../defaults";

export class CreateAutomationKeyDto {
	@IsString()
	@MaxLength(AUTOMATION_KEY_NAME_MAX_LENGTH)
	name: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	idInstance?: number | null;
}
