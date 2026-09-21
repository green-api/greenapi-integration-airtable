import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Response } from "express";
import { GreenApiLogger, IntegrationError } from "@green-api/greenapi-integration";
import { redactSecrets } from "../redact";

@Catch(IntegrationError)
export class IntegrationErrorFilter implements ExceptionFilter {
	private readonly logger = GreenApiLogger.getInstance(IntegrationErrorFilter.name);

	catch(exception: IntegrationError, host: ArgumentsHost) {
		const response = host.switchToHttp().getResponse<Response>();
		const message = redactSecrets(exception.message);
		this.logger.warn(message, {
			code: exception.code,
			statusCode: exception.statusCode,
			cause: exception.details instanceof Error ? exception.details.message : exception.details,
		});
		response.status(exception.statusCode).json({
			statusCode: exception.statusCode,
			code: exception.code,
			message,
		});
	}
}
