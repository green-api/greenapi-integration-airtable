import { IsBoolean } from "class-validator";

export class SetReceiveDto {
	@IsBoolean()
	receive: boolean;
}
