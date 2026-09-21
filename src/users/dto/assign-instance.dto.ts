import { ArrayMaxSize, IsArray, IsInt, Min } from "class-validator";

export class SetInstancesDto {
	@IsArray()
	@ArrayMaxSize(100)
	@IsInt({each: true})
	@Min(1, {each: true})
	idInstances: number[];
}
