import { Module } from "@nestjs/common";
import { BaseKeyModule } from "../bases/base-key.module";
import { UsersModule } from "./users.module";
import { UsersController } from "./users.controller";

@Module({
	imports: [BaseKeyModule, UsersModule],
	controllers: [UsersController],
})
export class UsersApiModule {}
