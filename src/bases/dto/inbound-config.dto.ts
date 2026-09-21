import { Type } from "class-transformer";
import { IsObject, IsOptional, IsString, Matches, ValidateNested } from "class-validator";

const TABLE_ID = /^tbl[A-Za-z0-9]{14}$/;
const FIELD_ID = /^fld[A-Za-z0-9]{14}$/;

export class InboundFieldMapDto {
	@IsOptional() @IsString() @Matches(FIELD_ID) direction?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) chatId?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) senderName?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) contact?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) type?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) text?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) attachments?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) timestamp?: string;
	@IsString() @Matches(FIELD_ID) idMessage: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) status?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) instance?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) quotedMessageId?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) location?: string;
	@IsOptional() @IsString() @Matches(FIELD_ID) details?: string;
}

export class ContactLinkDto {
	@IsString()
	@Matches(TABLE_ID)
	tableId: string;

	@IsString()
	@Matches(FIELD_ID)
	phoneFieldId: string;

	@IsOptional()
	@IsString()
	@Matches(FIELD_ID)
	chatIdFieldId?: string | null;
}

export class InboundConfigDto {
	@IsString()
	@Matches(TABLE_ID)
	tableId: string;

	@IsObject()
	@ValidateNested()
	@Type(() => InboundFieldMapDto)
	fields: InboundFieldMapDto;

	@IsOptional()
	@ValidateNested()
	@Type(() => ContactLinkDto)
	contactLink?: ContactLinkDto | null;
}
