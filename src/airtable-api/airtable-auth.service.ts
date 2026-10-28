import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { GreenApiLogger, IntegrationError } from "@green-api/greenapi-integration";
import { PrismaService } from "../prisma/prisma.service";
import { requireEnv } from "../env";
import { AirtableAuth, BaseUser, OAuthPurpose, PermissionLevel, UserAuth } from "../generated/prisma/client";
import { apiError, ErrorCode } from "../errors";
import { codeChallenge, createCodeVerifier, createState } from "./pkce";
import {
	ACCESS_TOKEN_REFRESH_MARGIN_MS,
	AIRTABLE_API_URL,
	AIRTABLE_AUTHORIZE_URL,
	AIRTABLE_BASES_PAGE_LIMIT,
	AIRTABLE_BASE_SCOPES,
	AIRTABLE_TOKEN_URL,
	AIRTABLE_USER_SCOPES,
	API_PREFIX,
	OAUTH_CALLBACK_PATH,
	OAUTH_STATE_TTL_MS,
} from "../defaults";
import { AirtableAuthView } from "../types";

interface TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	refresh_expires_in: number;
	scope: string;
}

export interface AirtableIdentity {
	id: string;
	email: string | null;
	permissionLevel: PermissionLevel;
}

export type CurrentPermission = PermissionLevel | "lost" | "unknown";

const REJECTED_TOKEN_STATUSES = [400, 401, 403];

@Injectable()
export class AirtableAuthService {
	private readonly logger = GreenApiLogger.getInstance(AirtableAuthService.name);
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly redirectUri: string;
	private readonly refreshing = new Map<string, Promise<AirtableAuth>>();
	private readonly refreshingUsers = new Map<string, Promise<UserAuth>>();

	constructor(private readonly prisma: PrismaService, config: ConfigService) {
		this.clientId = requireEnv(config, "AIRTABLE_CLIENT_ID");
		this.clientSecret = requireEnv(config, "AIRTABLE_CLIENT_SECRET");
		this.redirectUri = `${requireEnv(config, "APP_URL").replace(/\/+$/, "")}/${API_PREFIX}/${OAUTH_CALLBACK_PATH}`;
	}

	async createAuthorizationUrl(baseId: string, purpose: OAuthPurpose): Promise<{ url: string; state: string }> {
		await this.prisma.oAuthState.deleteMany({where: {createdAt: {lt: new Date(Date.now() - OAUTH_STATE_TTL_MS)}}});
		const state = createState();
		const codeVerifier = createCodeVerifier();
		await this.prisma.oAuthState.create({data: {state, baseId, purpose, codeVerifier}});
		const scopes = purpose === "base" || !(await this.hasWriter(baseId))
			? [...new Set([...AIRTABLE_USER_SCOPES, ...AIRTABLE_BASE_SCOPES])]
			: AIRTABLE_USER_SCOPES;
		const params = new URLSearchParams({
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			response_type: "code",
			scope: scopes.join(" "),
			state,
			code_challenge: codeChallenge(codeVerifier),
			code_challenge_method: "S256",
		});
		return {url: `${AIRTABLE_AUTHORIZE_URL}?${params.toString()}`, state};
	}

	async exchangeCode(state: string, code: string): Promise<{ baseId: string; purpose: OAuthPurpose; token: TokenResponse }> {
		const pending = await this.prisma.oAuthState.findUnique({where: {state}});
		if (!pending || pending.pendingKey || Date.now() - pending.createdAt.getTime() > OAUTH_STATE_TTL_MS) {
			throw apiError(ErrorCode.OAUTH_STATE_INVALID, "Authorization session expired; start again from the extension", 400);
		}
		const token = await this.exchange({
			grant_type: "authorization_code",
			code,
			redirect_uri: this.redirectUri,
			code_verifier: pending.codeVerifier,
		});
		return {baseId: pending.baseId, purpose: pending.purpose, token};
	}

	async storeBaseAuthorization(baseId: string, state: string, token: TokenResponse): Promise<void> {
		await this.store(baseId, token);
		await this.prisma.oAuthState.delete({where: {state}});
		this.logger.info("Airtable authorized for base writes", {baseId, scope: token.scope});
	}

	async adoptWriterIfMissing(baseId: string, token: TokenResponse, airtableUserId: string): Promise<boolean> {
		if (await this.hasWriter(baseId) || !token.scope.split(" ").includes("data.records:write")) {
			return false;
		}
		await this.store(baseId, token, airtableUserId);
		this.logger.info("Airtable writer adopted from identity confirmation", {baseId});
		return true;
	}

	private async hasWriter(baseId: string): Promise<boolean> {
		const auth = await this.prisma.airtableAuth.findUnique({where: {baseId}});
		return auth !== null && auth.refreshExpiresAt.getTime() > Date.now();
	}

	async identify(token: TokenResponse, baseId: string): Promise<AirtableIdentity> {
		const headers = {Authorization: `Bearer ${token.access_token}`};
		try {
			const [whoami, permissionLevel] = await Promise.all([
				axios.get<{ id: string; email?: string }>(`${AIRTABLE_API_URL}/meta/whoami`, {headers}),
				this.basePermission(token.access_token, baseId),
			]);
			return {id: whoami.data.id, email: whoami.data.email ?? null, permissionLevel};
		} catch (error: any) {
			throw apiError(ErrorCode.OAUTH_EXCHANGE_FAILED, `Could not read the Airtable identity: ${error.message}`, 502);
		}
	}

	async storeUserAuth(userId: string, token: TokenResponse): Promise<void> {
		const data = this.tokenData(token);
		await this.prisma.userAuth.upsert({where: {userId}, update: data, create: {userId, ...data}});
	}

	async currentPermission(user: Pick<BaseUser, "id" | "baseId" | "airtableUserId">): Promise<CurrentPermission> {
		let accessToken: string | null;
		try {
			accessToken = await this.userAccessToken(user);
		} catch (error) {
			return this.isRejected(error) ? "lost" : "unknown";
		}
		if (!accessToken) {
			return "lost";
		}
		try {
			return await this.basePermission(accessToken, user.baseId);
		} catch (error: any) {
			const status = error?.response?.status;
			return status === 401 || status === 403 ? "lost" : "unknown";
		}
	}

	private async basePermission(accessToken: string, baseId: string): Promise<PermissionLevel> {
		const headers = {Authorization: `Bearer ${accessToken}`};
		let offset: string | undefined;
		for (let page = 0; page < AIRTABLE_BASES_PAGE_LIMIT; page++) {
			const response = await axios.get<{ bases: Array<{ id: string; permissionLevel: PermissionLevel }>; offset?: string }>(
				`${AIRTABLE_API_URL}/meta/bases`,
				{headers, params: offset ? {offset} : undefined},
			);
			const base = response.data.bases.find(item => item.id === baseId);
			if (base) {
				return base.permissionLevel;
			}
			offset = response.data.offset;
			if (!offset) {
				break;
			}
		}
		return "none";
	}

	private async userAccessToken(user: Pick<BaseUser, "id" | "baseId" | "airtableUserId">): Promise<string | null> {
		const auth = await this.prisma.userAuth.findUnique({where: {userId: user.id}});
		if (auth) {
			if (auth.expiresAt.getTime() - Date.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS) {
				return auth.accessToken;
			}
			return (await this.refreshUser(auth)).accessToken;
		}
		const writer = await this.prisma.airtableAuth.findUnique({where: {baseId: user.baseId}});
		if (writer && writer.airtableUserId === user.airtableUserId) {
			return this.getAccessToken(user.baseId);
		}
		return null;
	}

	private refreshUser(auth: UserAuth): Promise<UserAuth> {
		const inFlight = this.refreshingUsers.get(auth.userId);
		if (inFlight) {
			return inFlight;
		}
		const task = (async () => {
			if (auth.refreshExpiresAt.getTime() <= Date.now()) {
				throw apiError(ErrorCode.AIRTABLE_TOKEN_EXPIRED, "Airtable sign-in expired", 401);
			}
			const token = await this.exchange({grant_type: "refresh_token", refresh_token: auth.refreshToken});
			const data = this.tokenData(token);
			return this.prisma.userAuth.update({where: {userId: auth.userId}, data});
		})().finally(() => this.refreshingUsers.delete(auth.userId));
		this.refreshingUsers.set(auth.userId, task);
		return task;
	}

	private isRejected(error: unknown): boolean {
		if (!(error instanceof IntegrationError)) {
			return false;
		}
		if (error.code === ErrorCode.AIRTABLE_TOKEN_EXPIRED) {
			return true;
		}
		const status = (error.details as { status?: number } | undefined)?.status;
		return error.code === ErrorCode.OAUTH_EXCHANGE_FAILED && status !== undefined && REJECTED_TOKEN_STATUSES.includes(status);
	}

	async parkPersonalKey(state: string, key: string): Promise<void> {
		await this.prisma.oAuthState.update({where: {state}, data: {pendingKey: key}});
	}

	async claimPersonalKey(state: string): Promise<{ baseId: string; key: string } | null> {
		const pending = await this.prisma.oAuthState.findUnique({where: {state}});
		if (!pending || pending.purpose !== "user") {
			throw apiError(ErrorCode.OAUTH_STATE_INVALID, "Unknown authorization session", 404);
		}
		if (Date.now() - pending.createdAt.getTime() > OAUTH_STATE_TTL_MS) {
			await this.prisma.oAuthState.delete({where: {state}});
			throw apiError(ErrorCode.OAUTH_STATE_INVALID, "The authorization session expired; confirm identity again", 410);
		}
		if (!pending.pendingKey) {
			return null;
		}
		await this.prisma.oAuthState.delete({where: {state}});
		return {baseId: pending.baseId, key: pending.pendingKey};
	}

	async getAccessToken(baseId: string): Promise<string> {
		const auth = await this.prisma.airtableAuth.findUnique({where: {baseId}});
		if (!auth) {
			throw apiError(ErrorCode.AIRTABLE_NOT_CONNECTED, "Airtable account is not connected for this base", 409);
		}
		if (auth.expiresAt.getTime() - Date.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS) {
			return auth.accessToken;
		}
		return (await this.refresh(auth)).accessToken;
	}

	async disconnect(baseId: string): Promise<void> {
		await this.prisma.airtableAuth.deleteMany({where: {baseId}});
	}

	async view(baseId: string): Promise<AirtableAuthView> {
		const auth = await this.prisma.airtableAuth.findUnique({where: {baseId}});
		return {
			connected: auth !== null && auth.refreshExpiresAt.getTime() > Date.now(),
			scope: auth?.scope ?? null,
			expiresAt: auth?.refreshExpiresAt.toISOString() ?? null,
		};
	}

	private refresh(auth: AirtableAuth): Promise<AirtableAuth> {
		const inFlight = this.refreshing.get(auth.baseId);
		if (inFlight) {
			return inFlight;
		}
		const task = (async () => {
			if (auth.refreshExpiresAt.getTime() <= Date.now()) {
				await this.disconnect(auth.baseId);
				throw apiError(ErrorCode.AIRTABLE_TOKEN_EXPIRED, "Airtable authorization expired; reconnect from the extension", 409);
			}
			const token = await this.exchange({grant_type: "refresh_token", refresh_token: auth.refreshToken});
			return this.store(auth.baseId, token);
		})().finally(() => this.refreshing.delete(auth.baseId));
		this.refreshing.set(auth.baseId, task);
		return task;
	}

	private async exchange(body: Record<string, string>): Promise<TokenResponse> {
		const form = new URLSearchParams(body);
		const headers = {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
		};
		try {
			const response = await axios.post<TokenResponse>(AIRTABLE_TOKEN_URL, form.toString(), {headers});
			return response.data;
		} catch (error: any) {
			const detail = error.response?.data?.error_description ?? error.response?.data?.error ?? error.message;
			const status: number | undefined = error.response?.status;
			this.logger.warn("Airtable token exchange failed", {detail, status});
			throw apiError(ErrorCode.OAUTH_EXCHANGE_FAILED, `Airtable rejected the token request: ${detail}`, 502, {status});
		}
	}

	private tokenData(token: TokenResponse) {
		const now = Date.now();
		return {
			accessToken: token.access_token,
			refreshToken: token.refresh_token,
			expiresAt: new Date(now + token.expires_in * 1000),
			refreshExpiresAt: new Date(now + token.refresh_expires_in * 1000),
		};
	}

	private store(baseId: string, token: TokenResponse, airtableUserId?: string): Promise<AirtableAuth> {
		const data = {...this.tokenData(token), scope: token.scope, ...(airtableUserId !== undefined ? {airtableUserId} : {})};
		return this.prisma.airtableAuth.upsert({where: {baseId}, update: data, create: {baseId, ...data}});
	}
}
