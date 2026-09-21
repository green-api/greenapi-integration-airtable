import { Injectable } from "@nestjs/common";
import { GreenApiLogger } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { AirtableAuthService } from "../airtable-api/airtable-auth.service";
import { InboundService } from "../inbound/inbound.service";
import { InstancesService } from "../instances/instances.service";
import { InboundConfigDto } from "./dto/inbound-config.dto";
import { toUserView } from "../users/users.service";
import { toInstanceSummary } from "../instances/instance-view";
import { Base } from "../generated/prisma/client";
import { BaseView, InboundConfig, UserWithInstances } from "../types";

@Injectable()
export class BasesService {
	private readonly logger = GreenApiLogger.getInstance(BasesService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly airtableAuth: AirtableAuthService,
		private readonly inbound: InboundService,
		private readonly instances: InstancesService,
	) {}

	async view(base: Base, user: UserWithInstances): Promise<BaseView> {
		return {
			baseId: base.id,
			airtable: await this.airtableAuth.view(base.id),
			inbound: base.inbound ?? null,
			webhookUrl: this.instances.webhookUrl,
			instances: (await this.prisma.getInstancesByBase(base.id)).map(toInstanceSummary),
			me: toUserView(user),
		};
	}

	async setInbound(baseId: string, dto: InboundConfigDto | null): Promise<{ inbound: InboundConfig | null }> {
		const config: InboundConfig | null = dto
			? {
				tableId: dto.tableId,
				fields: {...dto.fields},
				contactLink: dto.contactLink
					? {tableId: dto.contactLink.tableId, phoneFieldId: dto.contactLink.phoneFieldId, chatIdFieldId: dto.contactLink.chatIdFieldId ?? null}
					: null,
			}
			: null;
		await this.inbound.setInboundConfig(baseId, config);
		this.logger.info("Inbound config updated", {baseId, configured: config !== null});
		return {inbound: config};
	}

	async disconnectAirtable(baseId: string): Promise<{ ok: true }> {
		await this.airtableAuth.disconnect(baseId);
		this.logger.info("Airtable disconnected", {baseId});
		return {ok: true};
	}
}
