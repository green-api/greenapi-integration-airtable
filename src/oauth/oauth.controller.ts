import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { IntegrationError } from "@green-api/greenapi-integration";
import { IsString, Matches, MaxLength } from "class-validator";
import { AirtableAuthService } from "../airtable-api/airtable-auth.service";
import { AirtableApiService } from "../airtable-api/airtable-api.service";
import { UsersService, toUserView } from "../users/users.service";
import { PersonalKeyGuard } from "../bases/guards/base-key.guard";
import { AdminGuard } from "../bases/guards/admin.guard";
import { AuthReq, ClaimResponse } from "../types";
import { apiError, ErrorCode } from "../errors";
import { ADMIN_PERMISSION_LEVELS, IDENTITY_THROTTLE_LIMIT, THROTTLE_TTL_MS } from "../defaults";

const PAGE_STYLE = "font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5";

function page(title: string, body: string): string {
	return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="${PAGE_STYLE}"><h2>${title}</h2><p>${body}</p></body></html>`;
}

class IdentitySessionDto {
	@IsString()
	@Matches(/^app[A-Za-z0-9]{14}$/)
	baseId: string;
}

class ClaimDto {
	@IsString()
	@MaxLength(1024)
	state: string;
}

@Controller("oauth")
export class OauthController {
	constructor(
		private readonly auth: AirtableAuthService,
		private readonly api: AirtableApiService,
		private readonly users: UsersService,
	) {}

	@Post("identity")
	@HttpCode(HttpStatus.OK)
	@Throttle({default: {ttl: THROTTLE_TTL_MS, limit: IDENTITY_THROTTLE_LIMIT}})
	identity(@Body() dto: IdentitySessionDto) {
		return this.auth.createAuthorizationUrl(dto.baseId, "user");
	}

	@Post("base")
	@HttpCode(HttpStatus.OK)
	@UseGuards(PersonalKeyGuard, AdminGuard)
	base(@Req() req: AuthReq) {
		return this.auth.createAuthorizationUrl(req.base.id, "base");
	}

	@Post("claim")
	@HttpCode(HttpStatus.OK)
	async claim(@Body() dto: ClaimDto): Promise<ClaimResponse | { pending: true }> {
		const claimed = await this.auth.claimPersonalKey(dto.state);
		if (!claimed) {
			return {pending: true};
		}
		const user = await this.users.findByKey(claimed.key);
		if (!user) {
			throw apiError(ErrorCode.OAUTH_STATE_INVALID, "Personal key was revoked before it was claimed", 410);
		}
		return {personalKey: claimed.key, user: toUserView(user)};
	}

	@Get("callback")
	async callback(
		@Query("state") state: string | undefined,
		@Query("code") code: string | undefined,
		@Query("error") error: string | undefined,
		@Query("error_description") description: string | undefined,
		@Res() res: Response,
	) {
		if (error || !state || !code) {
			res.status(400).send(page("Airtable authorization failed", description ?? error ?? "Missing code or state."));
			return;
		}
		try {
			const {baseId, purpose, token} = await this.auth.exchangeCode(state, code);
			if (purpose === "base") {
				await this.auth.storeBaseAuthorization(baseId, state, token);
				await this.verifyBaseAccess(baseId);
				res.send(page("Airtable connected", "The adapter can now write into this base. You can close this tab."));
				return;
			}
			const identity = await this.auth.identify(token, baseId);
			const {key, user} = await this.users.issuePersonalKey(baseId, identity);
			await this.auth.parkPersonalKey(state, key);
			if ((ADMIN_PERMISSION_LEVELS as readonly string[]).includes(user.permissionLevel)) {
				await this.auth.adoptWriterIfMissing(baseId, token);
			}
			res.send(page("Identity confirmed", "You can close this tab and return to the extension."));
		} catch (e) {
			const message = e instanceof IntegrationError ? e.message : "Unexpected error.";
			res.status(400).send(page("Airtable authorization failed", message));
		}
	}

	private async verifyBaseAccess(baseId: string): Promise<void> {
		try {
			await this.api.listTables(baseId);
		} catch (e) {
			await this.auth.disconnect(baseId);
			throw apiError(
				ErrorCode.AIRTABLE_BASE_FORBIDDEN,
				"The Airtable account you authorized cannot access this base. Authorize with an account that has editor access to it.",
				403,
				e,
			);
		}
	}
}
