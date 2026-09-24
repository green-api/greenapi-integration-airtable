import {CONFIG_VERSION, DEFAULT_ADAPTER_URL} from '../defaults';
import {ButtonConfig, GlobalConfigV1, MappingConfig, MessageConfig, ServerConfig, TextSource, WriteBackConfig} from './types';

export function defaultMessage(type: MessageConfig['type']): MessageConfig {
    switch (type) {
        case 'text':
            return {type: 'text', text: {mode: 'field', fieldId: null}};
        case 'file':
            return {type: 'file', file: {mode: 'field', fieldId: null}, caption: null};
        case 'location':
            return {type: 'location', latitude: {mode: 'field', fieldId: null}, longitude: {mode: 'field', fieldId: null}, name: null, address: null};
        case 'contact':
            return {type: 'contact', phone: {mode: 'field', fieldId: null}, firstName: null, lastName: null, company: null};
        case 'poll':
            return {type: 'poll', question: {mode: 'template', template: ''}, options: ['', ''], multipleAnswers: false};
        case 'buttons':
            return {type: 'buttons', header: null, body: {mode: 'template', template: ''}, footer: null, buttons: [{type: 'reply', text: '', value: null}]};
    }
}

export function defaultConfig(): GlobalConfigV1 {
    return {
        v: CONFIG_VERSION,
        server: {url: DEFAULT_ADAPTER_URL},
        mapping: {
            tableId: null,
            viewId: null,
            phoneFieldId: null,
            message: defaultMessage('text'),
            writeBack: {statusFieldId: null, idMessageFieldId: null, sentAtFieldId: null, checkFieldId: null, chatIdFieldId: null},
        },
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asStringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function readTextSource(value: unknown): TextSource | null {
    const raw = asRecord(value);
    if (raw.mode === 'template') {
        return {mode: 'template', template: asString(raw.template)};
    }
    if (raw.mode === 'field') {
        return {mode: 'field', fieldId: asStringOrNull(raw.fieldId)};
    }
    return null;
}

function readButtons(value: unknown): ButtonConfig[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(item => {
        const raw = asRecord(item);
        const type = ['copy', 'call', 'url', 'reply'].includes(String(raw.type)) ? (raw.type as ButtonConfig['type']) : 'reply';
        return {type, text: asString(raw.text), value: readTextSource(raw.value)};
    });
}

function readMessage(value: unknown): MessageConfig {
    const raw = asRecord(value);
    switch (raw.type) {
        case 'text':
            return {type: 'text', text: readTextSource(raw.text) ?? {mode: 'field', fieldId: null}};
        case 'file':
            return {type: 'file', file: readTextSource(raw.file) ?? {mode: 'field', fieldId: null}, caption: readTextSource(raw.caption)};
        case 'location':
            return {
                type: 'location',
                latitude: readTextSource(raw.latitude) ?? {mode: 'field', fieldId: null},
                longitude: readTextSource(raw.longitude) ?? {mode: 'field', fieldId: null},
                name: readTextSource(raw.name),
                address: readTextSource(raw.address),
            };
        case 'contact':
            return {
                type: 'contact',
                phone: readTextSource(raw.phone) ?? {mode: 'field', fieldId: null},
                firstName: readTextSource(raw.firstName),
                lastName: readTextSource(raw.lastName),
                company: readTextSource(raw.company),
            };
        case 'poll':
            return {
                type: 'poll',
                question: readTextSource(raw.question) ?? {mode: 'template', template: ''},
                options: Array.isArray(raw.options) ? raw.options.map(asString) : ['', ''],
                multipleAnswers: raw.multipleAnswers === true,
            };
        case 'buttons':
            return {
                type: 'buttons',
                header: readTextSource(raw.header),
                body: readTextSource(raw.body) ?? {mode: 'template', template: ''},
                footer: readTextSource(raw.footer),
                buttons: readButtons(raw.buttons),
            };
        default:
            return defaultMessage('text');
    }
}

function readWriteBack(value: unknown): WriteBackConfig {
    const raw = asRecord(value);
    return {
        statusFieldId: asStringOrNull(raw.statusFieldId),
        idMessageFieldId: asStringOrNull(raw.idMessageFieldId),
        sentAtFieldId: asStringOrNull(raw.sentAtFieldId),
        checkFieldId: asStringOrNull(raw.checkFieldId),
        chatIdFieldId: asStringOrNull(raw.chatIdFieldId),
    };
}

function readMapping(value: unknown): MappingConfig {
    const raw = asRecord(value);
    return {
        tableId: asStringOrNull(raw.tableId),
        viewId: asStringOrNull(raw.viewId),
        phoneFieldId: asStringOrNull(raw.phoneFieldId),
        message: readMessage(raw.message),
        writeBack: readWriteBack(raw.writeBack),
    };
}

function readServer(value: unknown, fallback: ServerConfig): ServerConfig {
    const raw = asRecord(value);
    return {
        url: asStringOrNull(raw.url) ?? fallback.url,
    };
}

export function migrateConfig(raw: unknown): GlobalConfigV1 {
    const base = defaultConfig();
    const stored = asRecord(raw);
    if (stored.v !== undefined && stored.v !== CONFIG_VERSION) {
        return base;
    }
    return {
        v: CONFIG_VERSION,
        server: readServer(stored.server, base.server),
        mapping: readMapping(stored.mapping),
    };
}

type Json = string | number | boolean | null | Json[] | {[key: string]: Json | undefined};

export function stripNulls(value: unknown): Json | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value.map(item => stripNulls(item) ?? null);
    }
    if (typeof value === 'object') {
        const out: {[key: string]: Json | undefined} = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            const cleaned = stripNulls(item);
            if (cleaned !== undefined) {
                out[key] = cleaned;
            }
        }
        return out;
    }
    return value as Json;
}
