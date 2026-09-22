import {FieldType} from '@airtable/blocks/models';
import {Messenger} from './api/types';

export const CONFIG_ROOT_KEY = 'greenapi';
export const CONFIG_VERSION = 1;
export const DEFAULT_ADAPTER_URL = 'https://airtable.green-api.com';
export const DEFAULT_GREEN_API_URL = 'https://api.green-api.com';
export const API_PREFIX = '/api/v1';
export const JOB_POLL_INTERVAL_MS = 2000;
export const WRITE_BACK_BATCH_SIZE = 50;
export const PREVIEW_LIMIT = 200;
export const FILE_ITEMS_WARNING_THRESHOLD = 500;
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;
export const TEMPLATE_PLACEHOLDER = /\{([^{}]+)\}/g;

export const PHONE_FIELD_TYPES = [FieldType.PHONE_NUMBER, FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA, FieldType.MULTIPLE_LOOKUP_VALUES, FieldType.ROLLUP];
export const MESSAGE_FIELD_TYPES = [FieldType.MULTILINE_TEXT, FieldType.SINGLE_LINE_TEXT, FieldType.RICH_TEXT, FieldType.FORMULA];
export const ATTACHMENT_FIELD_TYPES = [FieldType.MULTIPLE_ATTACHMENTS, FieldType.URL, FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA, FieldType.MULTIPLE_LOOKUP_VALUES];
export const DEFAULT_FILE_NAME = 'file';
export const STATUS_FIELD_TYPES = [FieldType.SINGLE_SELECT, FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT];
export const STATUS_CHOICES = ['sent', 'delivered', 'read', 'failed', 'skipped'];
export const ID_MESSAGE_FIELD_TYPES = [FieldType.SINGLE_LINE_TEXT];
export const SENT_AT_FIELD_TYPES = [FieldType.DATE_TIME, FieldType.DATE];
export const CHECK_FIELD_TYPES = [FieldType.CHECKBOX, FieldType.SINGLE_SELECT, FieldType.SINGLE_LINE_TEXT];
export const CHAT_ID_FIELD_TYPES = [FieldType.SINGLE_LINE_TEXT];
export const CHECK_CHOICE_YES = 'yes';
export const CHECK_CHOICE_NO = 'no';
export const CHECK_BATCH_SIZE = 100;
export const CONTACT_IMPORT_BATCH_SIZE = 50;
export const QR_REFRESH_MS = 20000;
export const CHAT_HISTORY_COUNT = 100;
export const HISTORY_ALL_TIME_MINUTES = 10 * 365 * 24 * 60;
export const HISTORY_DEFAULT_MINUTES = 1440;
export const HISTORY_WINDOWS: Array<{minutes: number; label: string}> = [
    {minutes: 60, label: 'Last hour'},
    {minutes: 1440, label: 'Last 24 hours'},
    {minutes: 7 * 1440, label: 'Last 7 days'},
    {minutes: 30 * 1440, label: 'Last 30 days'},
    {minutes: HISTORY_ALL_TIME_MINUTES, label: 'All time'},
];
export const NUMBER_FIELD_TYPES = [FieldType.NUMBER, FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA, FieldType.MULTIPLE_LOOKUP_VALUES];
export const TEXT_LIKE_FIELD_TYPES = [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT, FieldType.RICH_TEXT, FieldType.FORMULA, FieldType.MULTIPLE_LOOKUP_VALUES, FieldType.EMAIL, FieldType.URL, FieldType.PHONE_NUMBER, FieldType.SINGLE_SELECT];
export const MESSAGES_TABLE_NAME = 'Messages';
export const MESSENGER_LABELS: Record<Messenger, string> = {whatsapp: 'WhatsApp', telegram: 'Telegram', max: 'MAX'};
export const MESSENGER_TONES: Record<Messenger, 'green' | 'blue' | 'violet'> = {whatsapp: 'green', telegram: 'blue', max: 'violet'};
export const MESSENGER_TEXT_LIMITS: Record<Messenger, number> = {whatsapp: 20000, telegram: 4096, max: 4000};
export const BUTTONS_MESSENGERS: readonly Messenger[] = ['whatsapp'];
export const POLL_GROUP_ONLY_MESSENGERS: readonly Messenger[] = ['telegram'];
export const GROUP_CHAT_ID = /^-\d+$|@g\.us$/;
export const MESSAGE_TYPE_LABELS: Record<string, string> = {
    text: 'Text',
    file: 'File',
    location: 'Location',
    contact: 'Contact card',
    poll: 'Poll',
    buttons: 'Buttons',
};

export const STATUS_SENT = 'sent';
export const STATUS_FAILED = 'failed';
export const STATUS_SKIPPED = 'skipped';
