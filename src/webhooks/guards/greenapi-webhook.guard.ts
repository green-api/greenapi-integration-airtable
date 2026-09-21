import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { BaseGreenApiAuthGuard } from "@green-api/greenapi-integration";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GreenApiWebhookGuard extends BaseGreenApiAuthGuard<Request> implements CanActivate {
	constructor(storage: PrismaService) {
		super(storage);
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		return this.validateRequest(context.switchToHttp().getRequest<Request>());
	}
}
