import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";
import { GREEN_API_URL_PATTERN } from "../../defaults";

export class CreateInstanceDto {
	@IsInt()
	@Min(1)
	idInstance: number;

	@IsString()
	@MaxLength(128)
	apiTokenInstance: string;

	@IsString()
	@Matches(GREEN_API_URL_PATTERN, {message: "apiUrl must be the GREEN-API host shown in the console, e.g. https://1103.api.green-api.com"})
	@MaxLength(191)
	apiUrl: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;
}
