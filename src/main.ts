import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { Settings } from "@green-api/greenapi-integration";
import { ValidationExceptionFilter } from "./filters/validation-exception.filter";
import { IntegrationErrorFilter } from "./filters/integration-error.filter";
import { API_PREFIX, DEFAULT_PORT } from "./defaults";

declare global {
	namespace PrismaJson {
		type InstanceSettings = Settings;
		type InboundConfig = import("./types").InboundConfig;
		type JobWriteBack = import("./types").JobWriteBack;
		type OutboundPayload = import("./types").OutboundPayload;
	}
}

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.setGlobalPrefix(API_PREFIX);
	app.enableCors({
		origin: "*",
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Authorization", "Content-Type"],
	});
	app.use(helmet());
	app.useGlobalFilters(new ValidationExceptionFilter(), new IntegrationErrorFilter());
	app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));
	app.enableShutdownHooks();
	await app.listen(Number(process.env.PORT) || DEFAULT_PORT);
}

void bootstrap();
