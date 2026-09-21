import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CHAT_HISTORY_MAX_COUNT, CHECK_NUMBERS_MAX, HISTORY_MAX_MINUTES } from "../../defaults";

export class CheckNumbersDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(CHECK_NUMBERS_MAX)
	@IsString({each: true})
	@MaxLength(64, {each: true})
	phones: string[];
}

export class ImportHistoryDto {
	@IsInt()
	@Min(1)
	@Max(HISTORY_MAX_MINUTES)
	minutes: number;
}

export class ImportChatDto {
	@IsString()
	@MaxLength(64)
	chatId: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(CHAT_HISTORY_MAX_COUNT)
	count?: number;
}
