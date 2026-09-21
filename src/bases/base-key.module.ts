import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { PersonalKeyGuard } from "./guards/base-key.guard";
import { AdminGuard } from "./guards/admin.guard";

@Module({
	imports: [UsersModule],
	providers: [PersonalKeyGuard, AdminGuard],
	exports: [PersonalKeyGuard, AdminGuard, UsersModule],
})
export class BaseKeyModule {}
