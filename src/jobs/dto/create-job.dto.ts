import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUrl,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { MAX_BUTTONS, MAX_JOB_ITEMS, MAX_MESSAGE_LENGTH, MAX_POLL_OPTIONS } from "../../defaults";
import { ButtonType, OutboundPayload, StatusFieldType } from "../../types";

const PAYLOAD_TYPES = ["text", "file", "location", "contact", "poll", "buttons"] as const;
const BUTTON_TYPES: ButtonType[] = ["copy", "call", "url", "reply"];
const STATUS_FIELD_TYPES: StatusFieldType[] = ["singleSelect", "text"];

export class ButtonDto {
	@IsIn(BUTTON_TYPES)
	type: ButtonType;

	@IsString()
	@MaxLength(25)
	text: string;

	@IsOptional()
	@IsString()
	@MaxLength(2048)
	value?: string;
}

export class PayloadDto {
	@IsIn(PAYLOAD_TYPES)
	type: OutboundPayload["type"];

	@IsOptional() @IsString() @MaxLength(MAX_MESSAGE_LENGTH) text?: string;

	@IsOptional() @IsUrl({protocols: ["https", "http"], require_protocol: true}) @MaxLength(2048) url?: string;
	@IsOptional() @IsString() @MaxLength(255) fileName?: string;
	@IsOptional() @IsString() @MaxLength(MAX_MESSAGE_LENGTH) caption?: string;

	@IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
	@IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
	@IsOptional() @IsString() @MaxLength(255) name?: string;
	@IsOptional() @IsString() @MaxLength(1024) address?: string;

	@IsOptional() @IsString() @MaxLength(64) phone?: string;
	@IsOptional() @IsString() @MaxLength(100) firstName?: string;
	@IsOptional() @IsString() @MaxLength(100) middleName?: string;
	@IsOptional() @IsString() @MaxLength(100) lastName?: string;
	@IsOptional() @IsString() @MaxLength(100) company?: string;

	@IsOptional() @IsString() @MaxLength(255) question?: string;
	@IsOptional() @IsArray() @ArrayMaxSize(MAX_POLL_OPTIONS) @IsString({each: true}) @MaxLength(100, {each: true}) options?: string[];
	@IsOptional() @IsBoolean() multipleAnswers?: boolean;

	@IsOptional() @IsString() @MaxLength(255) header?: string;
	@IsOptional() @IsString() @MaxLength(MAX_MESSAGE_LENGTH) body?: string;
	@IsOptional() @IsString() @MaxLength(255) footer?: string;
	@IsOptional() @IsArray() @ArrayMaxSize(MAX_BUTTONS) @ValidateNested({each: true}) @Type(() => ButtonDto) buttons?: ButtonDto[];
}

export class JobItemDto {
	@IsOptional()
	@IsString()
	@Matches(/^rec[A-Za-z0-9]{14}$/)
	recordId?: string;

	@IsString()
	@MaxLength(64)
	phone: string;

	@ValidateNested()
	@Type(() => PayloadDto)
	payload: PayloadDto;
}

export class JobWriteBackDto {
	@IsString()
	@Matches(/^tbl[A-Za-z0-9]{14}$/)
	tableId: string;

	@IsOptional()
	@IsString()
	@Matches(/^fld[A-Za-z0-9]{14}$/)
	statusFieldId?: string | null;

	@IsOptional()
	@IsIn(STATUS_FIELD_TYPES)
	statusFieldType?: StatusFieldType | null;
}

export class CreateJobDto {
	@IsInt()
	@Min(1)
	idInstance: number;

	@IsOptional()
	@ValidateNested()
	@Type(() => JobWriteBackDto)
	writeBack?: JobWriteBackDto;

	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_JOB_ITEMS)
	@ValidateNested({each: true})
	@Type(() => JobItemDto)
	items: JobItemDto[];
}

export function toPayload(dto: PayloadDto): OutboundPayload | string {
	switch (dto.type) {
		case "text":
			return dto.text?.trim() ? {type: "text", text: dto.text} : "text is required";
		case "file":
			return dto.url && dto.fileName
				? {type: "file", url: dto.url, fileName: dto.fileName, caption: dto.caption}
				: "url and fileName are required";
		case "location":
			return typeof dto.latitude === "number" && typeof dto.longitude === "number"
				? {type: "location", latitude: dto.latitude, longitude: dto.longitude, name: dto.name, address: dto.address}
				: "latitude and longitude are required";
		case "contact":
			return dto.phone?.replace(/\D/g, "")
				? {type: "contact", phone: dto.phone, firstName: dto.firstName, middleName: dto.middleName, lastName: dto.lastName, company: dto.company}
				: "phone is required";
		case "poll":
			return dto.question?.trim() && dto.options && dto.options.length >= 2
				? {type: "poll", question: dto.question, options: dto.options, multipleAnswers: dto.multipleAnswers ?? false}
				: "question and at least two options are required";
		case "buttons": {
			if (!dto.body?.trim() || !dto.buttons || dto.buttons.length === 0) {
				return "body and at least one button are required";
			}
			const reply = dto.buttons.filter(b => b.type === "reply").length;
			if (reply !== 0 && reply !== dto.buttons.length) {
				return "reply buttons cannot be mixed with copy/call/url buttons";
			}
			if (dto.buttons.some(b => b.type !== "reply" && !b.value)) {
				return "copy/call/url buttons need a value";
			}
			return {type: "buttons", header: dto.header, body: dto.body, footer: dto.footer, buttons: dto.buttons.map(b => ({type: b.type, text: b.text, value: b.value}))};
		}
	}
}
