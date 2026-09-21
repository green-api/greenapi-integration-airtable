export type InstanceState = 'notAuthorized' | 'authorized' | 'yellowCard' | 'blocked' | 'starting' | 'suspended' | 'pendingPassword';

export type Messenger = 'whatsapp' | 'telegram' | 'max';

export interface InstanceSummaryView {
    idInstance: number;
    name: string | null;
    messenger: Messenger;
    stateInstance: InstanceState | null;
}

export interface InstanceView {
    idInstance: number;
    name: string | null;
    messenger: Messenger;
    stateInstance: InstanceState | null;
    phone: string | null;
    receiveWebhooks: boolean;
}

export type ButtonType = 'copy' | 'call' | 'url' | 'reply';

export interface OutboundButton {
    type: ButtonType;
    text: string;
    value?: string;
}

export type OutboundPayload =
    | {type: 'text'; text: string}
    | {type: 'file'; url: string; fileName: string; caption?: string}
    | {type: 'location'; latitude: number; longitude: number; name?: string; address?: string}
    | {type: 'contact'; phone: string; firstName?: string; middleName?: string; lastName?: string; company?: string}
    | {type: 'poll'; question: string; options: string[]; multipleAnswers: boolean}
    | {type: 'buttons'; header?: string; body: string; footer?: string; buttons: OutboundButton[]};

export interface JobItemInput {
    recordId: string;
    phone: string;
    payload: OutboundPayload;
}

export type StatusFieldType = 'singleSelect' | 'text';

export interface JobWriteBack {
    tableId: string;
    statusFieldId: string | null;
    statusFieldType: StatusFieldType | null;
}

export interface CreateJobRequest {
    idInstance: number;
    writeBack?: JobWriteBack;
    items: JobItemInput[];
}

export type JobStatus = 'queued' | 'running' | 'done' | 'cancelled';
export type JobItemStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface JobItemView {
    recordId: string | null;
    chatId: string;
    status: JobItemStatus;
    idMessage: string | null;
    error: string | null;
}

export interface JobSummaryView {
    id: string;
    idInstance: number;
    status: JobStatus;
    total: number;
    sent: number;
    failed: number;
    createdAt: string;
    finishedAt: string | null;
}

export interface JobView extends JobSummaryView {
    items: JobItemView[];
}

export interface InboundFieldMap {
    direction?: string;
    chatId?: string;
    senderName?: string;
    contact?: string;
    type?: string;
    text?: string;
    attachments?: string;
    timestamp?: string;
    idMessage?: string;
    status?: string;
    instance?: string;
    quotedMessageId?: string;
    location?: string;
    details?: string;
}

export interface InboundConfig {
    tableId: string;
    fields: InboundFieldMap;
    contactLink: {tableId: string; phoneFieldId: string; chatIdFieldId: string | null} | null;
}

export interface AirtableAuthView {
    connected: boolean;
    scope: string | null;
    expiresAt: string | null;
}

export type PermissionLevel = 'none' | 'read' | 'comment' | 'edit' | 'create' | 'interfaceOnly';

export interface UserView {
    id: string;
    airtableUserId: string;
    email: string | null;
    name: string | null;
    permissionLevel: PermissionLevel;
    isAdmin: boolean;
    idInstances: number[];
    hasKey: boolean;
    lastSeenAt: string;
}

export interface BaseView {
    baseId: string;
    airtable: AirtableAuthView;
    inbound: InboundConfig | null;
    webhookUrl: string;
    instances: InstanceSummaryView[];
    me: UserView;
}

export interface CheckResult {
    phone: string;
    exists: boolean | null;
    chatId: string | null;
    error: string | null;
}

export interface ImportResult {
    imported: number;
    skipped: number;
}

export interface QrView {
    status: 'qr' | 'authorized' | 'error';
    image: string | null;
    message: string | null;
}

export interface QueueView {
    count: number;
}

export interface ContactView {
    chatId: string;
    name: string;
    phone: string | null;
    username: string | null;
}

export interface AutomationKeyView {
    id: string;
    name: string;
    idInstance: number | null;
    createdAt: string;
    lastUsedAt: string | null;
}

export type ClaimResponse = {personalKey: string; user: UserView} | {pending: true};

export type AdapterErrorCode =
    | 'KEY_INVALID'
    | 'AUTOMATION_KEY_INVALID'
    | 'AUTOMATION_KEY_NOT_FOUND'
    | 'INSTANCE_NOT_FOUND'
    | 'INSTANCE_ALREADY_CONNECTED'
    | 'INSTANCE_CREDENTIALS_INVALID'
    | 'INSTANCE_NOT_AUTHORIZED'
    | 'INSTANCE_SETTINGS_UNAVAILABLE'
    | 'MESSENGER_UNSUPPORTED'
    | 'JOB_NOT_FOUND'
    | 'JOB_NOT_CANCELLABLE'
    | 'PHONE_INVALID'
    | 'RECIPIENT_NOT_FOUND'
    | 'FILE_URL_EXPIRED'
    | 'VALIDATION_FAILED'
    | 'OAUTH_STATE_INVALID'
    | 'OAUTH_EXCHANGE_FAILED'
    | 'AIRTABLE_NOT_CONNECTED'
    | 'AIRTABLE_BASE_FORBIDDEN'
    | 'AIRTABLE_TOKEN_EXPIRED'
    | 'AIRTABLE_API_ERROR'
    | 'AIRTABLE_RATE_LIMITED'
    | 'INBOUND_NOT_CONFIGURED'
    | 'INBOUND_DELIVERY_FAILED'
    | 'QR_UNAVAILABLE'
    | 'GREEN_API_RATE_LIMITED'
    | 'GREEN_API_ERROR'
    | 'WEBHOOK_SETTINGS_FAILED'
    | 'USER_NOT_MEMBER'
    | 'USER_NOT_ADMIN'
    | 'USER_NOT_FOUND'
    | 'INSTANCE_NOT_ASSIGNED'
    | 'INSTANCE_FORBIDDEN'
    | 'RATE_LIMITED'
    | 'NETWORK'
    | 'UNKNOWN';
