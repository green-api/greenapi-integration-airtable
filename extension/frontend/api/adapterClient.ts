import {API_PREFIX} from '../defaults';
import {
    AdapterErrorCode,
    AutomationKeyView,
    CheckResult,
    ContactView,
    ImportResult,
    QrView,
    QueueView,
    BaseView,
    ClaimResponse,
    CreateJobRequest,
    InboundConfig,
    InstanceView,
    JobSummaryView,
    JobView,
    UserView,
} from './types';

export class AdapterError extends Error {
    constructor(
        public readonly code: AdapterErrorCode,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AdapterError';
    }
}

const ERROR_COPY: Record<AdapterErrorCode, string> = {
    KEY_INVALID: 'Your identity confirmation is no longer valid on this browser. Confirm it again.',
    AUTOMATION_KEY_INVALID: 'This automation key is unknown or was revoked.',
    AUTOMATION_KEY_NOT_FOUND: 'This automation key no longer exists.',
    INSTANCE_NOT_FOUND: 'That instance is not connected to this base.',
    INSTANCE_ALREADY_CONNECTED: 'That instance is already connected to another base.',
    INSTANCE_CREDENTIALS_INVALID: 'GREEN-API rejected the idInstance / apiTokenInstance pair. Check them in the GREEN-API console.',
    INSTANCE_NOT_AUTHORIZED: 'The instance is not authorized. Link a phone to it in the GREEN-API console first.',
    INSTANCE_SETTINGS_UNAVAILABLE: 'GREEN-API did not return the instance settings. Try again in a minute.',
    MESSENGER_UNSUPPORTED: 'This instance type is not supported. WhatsApp, Telegram and MAX instances work.',
    JOB_NOT_FOUND: 'That send job no longer exists.',
    JOB_NOT_CANCELLABLE: 'That send job has already finished.',
    PHONE_INVALID: 'Not a valid phone number.',
    RECIPIENT_NOT_FOUND: 'This phone number has no account on the messenger.',
    FILE_URL_EXPIRED: 'The attachment link expired before it could be sent.',
    VALIDATION_FAILED: 'The adapter rejected the request as malformed.',
    OAUTH_STATE_INVALID: 'The authorization window expired. Start again.',
    OAUTH_EXCHANGE_FAILED: 'Airtable did not accept the authorization. Try again.',
    AIRTABLE_NOT_CONNECTED: 'Connect an Airtable account first.',
    AIRTABLE_BASE_FORBIDDEN: 'The connected Airtable account cannot access this base. Reconnect with an account that has editor access.',
    AIRTABLE_TOKEN_EXPIRED: 'The Airtable authorization expired. Reconnect the Airtable account.',
    AIRTABLE_API_ERROR: 'Airtable returned an error.',
    AIRTABLE_RATE_LIMITED: 'Airtable rate limit hit; the adapter will retry.',
    INBOUND_DELIVERY_FAILED: 'The adapter could not write into Airtable. Check the Receiving settings.',
    GREEN_API_RATE_LIMITED: 'GREEN-API is rate-limiting this instance. Wait a minute and try again.',
    GREEN_API_ERROR: 'GREEN-API returned an error — see the details below.',
    QR_UNAVAILABLE: 'GREEN-API did not return a QR code. Try again in a few seconds.',
    INBOUND_NOT_CONFIGURED: 'Choose a messages table first.',
    WEBHOOK_SETTINGS_FAILED: 'GREEN-API refused to update the instance webhook settings.',
    USER_NOT_MEMBER: 'That Airtable account cannot edit this base, so it cannot send from it.',
    USER_NOT_ADMIN: 'Only base owners and creators can change this.',
    USER_NOT_FOUND: 'That person is no longer registered on this base.',
    INSTANCE_NOT_ASSIGNED: 'No instance is assigned to you. Ask a base owner to assign one in settings.',
    INSTANCE_FORBIDDEN: 'You may only send with the instance assigned to you.',
    RATE_LIMITED: 'Too many requests. Wait a minute and try again.',
    NETWORK: 'Could not reach the adapter. Check the adapter URL and your connection.',
    UNKNOWN: 'Unexpected adapter error.',
};

export function describeError(error: unknown): string {
    if (error instanceof AdapterError) {
        return error.code === 'GREEN_API_ERROR' ? error.message : ERROR_COPY[error.code] ?? error.message;
    }
    return error instanceof Error ? error.message : String(error);
}

export class AdapterClient {
    constructor(
        private readonly baseUrl: string,
        private readonly personalKey: string | null,
    ) {}

    me(): Promise<BaseView> {
        return this.request('GET', '/bases/me');
    }

    setInbound(config: InboundConfig): Promise<{inbound: InboundConfig | null}> {
        return this.request('PUT', '/bases/inbound', config);
    }

    clearInbound(): Promise<{inbound: null}> {
        return this.request('DELETE', '/bases/inbound');
    }

    disconnectAirtable(): Promise<{ok: true}> {
        return this.request('DELETE', '/bases/airtable');
    }

    identitySession(baseId: string): Promise<{url: string; state: string}> {
        return this.request('POST', '/oauth/identity', {baseId}, false);
    }

    baseAuthSession(): Promise<{url: string; state: string}> {
        return this.request('POST', '/oauth/base');
    }

    oauthClaim(state: string): Promise<ClaimResponse> {
        return this.request('POST', '/oauth/claim', {state}, false);
    }

    listUsers(): Promise<UserView[]> {
        return this.request('GET', '/users');
    }

    setUserInstances(userId: string, idInstances: number[]): Promise<UserView> {
        return this.request('PUT', `/users/${userId}/instances`, {idInstances});
    }

    revokeUser(userId: string): Promise<UserView> {
        return this.request('POST', `/users/${userId}/revoke`);
    }

    removeUser(userId: string): Promise<UserView> {
        return this.request('DELETE', `/users/${userId}`);
    }

    checkNumbers(idInstance: number, phones: string[]): Promise<CheckResult[]> {
        return this.request('POST', `/instances/${idInstance}/check`, {phones});
    }

    importHistory(idInstance: number, minutes: number): Promise<ImportResult> {
        return this.request('POST', `/instances/${idInstance}/history`, {minutes});
    }

    importChat(idInstance: number, chatId: string, count?: number): Promise<ImportResult> {
        return this.request('POST', `/instances/${idInstance}/chat-history`, {chatId, count});
    }

    qr(idInstance: number): Promise<QrView> {
        return this.request('GET', `/instances/${idInstance}/qr`);
    }

    queue(idInstance: number): Promise<QueueView> {
        return this.request('GET', `/instances/${idInstance}/queue`);
    }

    clearQueue(idInstance: number): Promise<QueueView> {
        return this.request('POST', `/instances/${idInstance}/queue/clear`);
    }

    listContacts(idInstance: number): Promise<ContactView[]> {
        return this.request('GET', `/instances/${idInstance}/contacts`);
    }

    listAutomationKeys(): Promise<AutomationKeyView[]> {
        return this.request('GET', '/automation-keys');
    }

    createAutomationKey(name: string, idInstance: number | null): Promise<{key: string; automationKey: AutomationKeyView}> {
        return this.request('POST', '/automation-keys', {name, idInstance});
    }

    revokeAutomationKey(keyId: string): Promise<AutomationKeyView> {
        return this.request('DELETE', `/automation-keys/${keyId}`);
    }

    listInstances(): Promise<InstanceView[]> {
        return this.request('GET', '/instances');
    }

    addInstance(idInstance: number, apiTokenInstance: string, apiUrl: string, name?: string): Promise<InstanceView> {
        return this.request('POST', '/instances', {idInstance, apiTokenInstance, apiUrl, name});
    }

    setReceive(idInstance: number, receive: boolean): Promise<InstanceView> {
        return this.request('PATCH', `/instances/${idInstance}/receive`, {receive});
    }

    removeInstance(idInstance: number): Promise<InstanceView> {
        return this.request('DELETE', `/instances/${idInstance}`);
    }

    createJob(body: CreateJobRequest): Promise<{jobId: string}> {
        return this.request('POST', '/jobs', body);
    }

    listJobs(limit: number): Promise<JobSummaryView[]> {
        return this.request('GET', `/jobs?limit=${limit}`);
    }

    getJob(jobId: string): Promise<JobView> {
        return this.request('GET', `/jobs/${jobId}`);
    }

    cancelJob(jobId: string): Promise<JobSummaryView> {
        return this.request('POST', `/jobs/${jobId}/cancel`);
    }

    private async request<T>(method: string, path: string, body?: unknown, authenticated = true): Promise<T> {
        const headers: Record<string, string> = {};
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        if (authenticated) {
            if (!this.personalKey) {
                throw new AdapterError('KEY_INVALID', 'Identity not confirmed', 401);
            }
            headers.Authorization = `Bearer ${this.personalKey}`;
        }
        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${API_PREFIX}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
            });
        } catch (error) {
            throw new AdapterError('NETWORK', (error as Error).message, 0);
        }
        const text = await response.text();
        let data: unknown = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!response.ok) {
            throw toAdapterError(response.status, data);
        }
        return data as T;
    }
}

function toAdapterError(status: number, data: unknown): AdapterError {
    const payload = (typeof data === 'object' && data !== null ? data : {}) as {code?: string; message?: string};
    if (status === 429) {
        return new AdapterError('RATE_LIMITED', payload.message ?? 'Too many requests', status);
    }
    if (payload.code && payload.code in ERROR_COPY) {
        return new AdapterError(payload.code as AdapterErrorCode, payload.message ?? payload.code, status);
    }
    if (status === 400) {
        return new AdapterError('VALIDATION_FAILED', payload.message ?? 'Validation failed', status);
    }
    return new AdapterError('UNKNOWN', payload.message ?? `HTTP ${status}`, status);
}
