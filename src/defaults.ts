import { Messenger } from "./generated/prisma/client";

export const API_PREFIX = "api/v1";
export const DEFAULT_PORT = 3000;
export const BASE_KEY_BYTES = 32;
export const WEBHOOK_TOKEN_BYTES = 24;
export const MAX_JOB_ITEMS = 5000;
export const MAX_MESSAGE_LENGTH = 20000;
export const MESSENGER_TEXT_LIMITS: Record<Messenger, number> = {whatsapp: 20000, telegram: 4096, max: 4000};
export const BUTTONS_MESSENGERS: readonly Messenger[] = ["whatsapp"];
export const POLL_GROUP_ONLY_MESSENGERS: readonly Messenger[] = ["telegram"];
export const GROUP_CHAT_ID = /^-\d+$|@g\.us$/;
export const TYPE_INSTANCE_TO_MESSENGER: Record<string, Messenger> = {whatsapp: "whatsapp", telegram: "telegram", v3: "max", max: "max"};
export const DEFAULT_TYPE_INSTANCE = "whatsapp";
export const INSTANCE_REFRESH_TTL_MS = 60 * 1000;
export const MAX_POLL_OPTIONS = 12;
export const MAX_BUTTONS = 3;
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;
export const FILE_URL_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const UPLOAD_DOWNLOAD_TIMEOUT_MS = 60 * 1000;
export const DOWNLOAD_MAX_REDIRECTS = 3;
export const ERROR_MAX_LENGTH = 1000;
export const GREEN_API_URL_PATTERN = /^https:\/\/([a-z0-9-]+\.)*(green-api\.com|greenapi\.com)\/?$/i;
export const INSTANCE_TOKEN_IN_PATH = /(\/waInstance\d+\/[A-Za-z]+\/)[A-Za-z0-9]+/g;
export const CHECK_NUMBERS_MAX = 100;
export const HISTORY_ALL_TIME_MINUTES = 10 * 365 * 24 * 60;
export const HISTORY_MAX_MINUTES = HISTORY_ALL_TIME_MINUTES;
export const CHAT_HISTORY_DEFAULT_COUNT = 100;
export const CHAT_HISTORY_MAX_COUNT = 500;
export const CONTACT_TYPE_USER = "user";
export const JOBS_LIST_DEFAULT_LIMIT = 20;
export const JOBS_LIST_MAX_LIMIT = 100;
export const THROTTLE_TTL_MS = 60000;
export const THROTTLE_LIMIT = 300;
export const WEBHOOK_PATH = "webhooks/green-api";
export const HANDLED_WEBHOOK_TYPES = [
	"stateInstanceChanged",
	"incomingMessageReceived",
	"outgoingMessageReceived",
	"outgoingAPIMessageReceived",
	"outgoingMessageStatus",
] as const;
export const RECEIVE_SETTINGS = {
	outgoingWebhook: "yes",
	outgoingMessageWebhook: "yes",
	outgoingAPIMessageWebhook: "yes",
	incomingWebhook: "yes",
	stateWebhook: "yes",
	pollMessageWebhook: "yes",
} as const;

export const AIRTABLE_AUTHORIZE_URL = "https://airtable.com/oauth2/v1/authorize";
export const AIRTABLE_TOKEN_URL = "https://airtable.com/oauth2/v1/token";
export const AIRTABLE_API_URL = "https://api.airtable.com/v0";
export const AIRTABLE_BASE_SCOPES = ["data.records:read", "data.records:write", "schema.bases:read"];
export const AIRTABLE_USER_SCOPES = ["user.email:read", "schema.bases:read"];
export const PERSONAL_KEY_PREFIX = "pk_";
export const AUTOMATION_KEY_PREFIX = "ak_";
export const AUTOMATION_KEY_NAME_MAX_LENGTH = 60;
export const AUTOMATION_SEND_TIMEOUT_MS = 25 * 1000;
export const AUTOMATION_SEND_POLL_MS = 250;
export const ADMIN_PERMISSION_LEVELS = ["create"] as const;
export const SENDER_PERMISSION_LEVELS = ["create", "edit"] as const;
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_CALLBACK_PATH = "oauth/callback";
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
export const AIRTABLE_RATE_LIMIT_PER_SECOND = 5;
export const AIRTABLE_RATE_LIMIT_BACKOFF_MS = 30 * 1000;
export const AIRTABLE_WRITE_BATCH = 10;
export const AIRTABLE_FIND_DEFAULT_MAX = 5;
export const MESSAGE_ID_LOOKUP_CHUNK = 50;

export const CONTACT_CACHE_TTL_MS = 10 * 60 * 1000;
export const WHATSAPP_GROUP_ID = /^\d+-?\d*@g\.us$/;
export const PHONE_CHAT_ID = /^(\d+)@c\.us$/;
export const NUMERIC_CHAT_ID = /^-?\d+$/;

export const DIRECTION_INCOMING = "incoming";
export const DIRECTION_OUTGOING = "outgoing";
export const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;
export const IDENTITY_THROTTLE_LIMIT = 10;
