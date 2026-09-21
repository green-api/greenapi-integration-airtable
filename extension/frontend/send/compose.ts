import {Field, FieldType, Record, Table} from '@airtable/blocks/models';
import {BUTTONS_MESSENGERS, DEFAULT_FILE_NAME, GROUP_CHAT_ID, MAX_PHONE_DIGITS, MESSENGER_LABELS, MESSENGER_TEXT_LIMITS, MIN_PHONE_DIGITS, POLL_GROUP_ONLY_MESSENGERS, TEMPLATE_PLACEHOLDER} from '../defaults';
import {ButtonConfig, MappingConfig, MessageConfig, TextSource} from '../config/types';
import {JobItemInput, Messenger, OutboundPayload} from '../api/types';

export interface ResolvedMapping {
    table: Table;
    phoneField: Field;
    message: MessageConfig;
    statusField: Field | null;
    idMessageField: Field | null;
    sentAtField: Field | null;
    checkField: Field | null;
    chatIdField: Field | null;
}

export interface PreviewRow {
    record: Record;
    phone: string;
    chatId: string | null;
    payload: OutboundPayload | null;
    summary: string;
    problem: string | null;
    unknownPlaceholders: string[];
}

const WHATSAPP_GROUP_ID = /^\d+-?\d*@g\.us$/;
const PHONE_CHAT_ID = /^\d+@c\.us$/;
const NUMERIC_CHAT_ID = /^-?\d+$/;
const FILE_URL = /^https?:\/\//i;

export function previewChatId(raw: string, messenger: Messenger): string | null {
    const trimmed = raw.trim();
    if (messenger === 'whatsapp' ? WHATSAPP_GROUP_ID.test(trimmed) : NUMERIC_CHAT_ID.test(trimmed) || PHONE_CHAT_ID.test(trimmed)) {
        return trimmed;
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
        return null;
    }
    return `${digits}@c.us`;
}

export function templatePlaceholders(template: string): string[] {
    const names = new Set<string>();
    for (const match of template.matchAll(TEMPLATE_PLACEHOLDER)) {
        names.add(match[1].trim());
    }
    return [...names];
}

export function renderTemplate(template: string, record: Record, table: Table): {text: string; unknown: string[]} {
    const unknown: string[] = [];
    const text = template.replace(TEMPLATE_PLACEHOLDER, (whole, name: string) => {
        const field = table.getFieldByNameIfExists(name.trim());
        if (!field) {
            unknown.push(name.trim());
            return whole;
        }
        return record.getCellValueAsString(field);
    });
    return {text, unknown};
}

function templateFields(template: string, table: Table): Field[] {
    return templatePlaceholders(template)
        .map(name => table.getFieldByNameIfExists(name))
        .filter((field): field is Field => field !== null);
}

function sourceFields(source: TextSource | null, table: Table): Field[] {
    if (!source) {
        return [];
    }
    if (source.mode === 'template') {
        return templateFields(source.template, table);
    }
    const field = source.fieldId ? table.getFieldByIdIfExists(source.fieldId) : null;
    return field ? [field] : [];
}

function sourceReady(source: TextSource | null, table: Table): boolean {
    if (!source) {
        return true;
    }
    if (source.mode === 'template') {
        return source.template.trim().length > 0;
    }
    return Boolean(source.fieldId && table.getFieldByIdIfExists(source.fieldId));
}

function fieldById(table: Table, id: string | null): Field | null {
    return id ? table.getFieldByIdIfExists(id) : null;
}

export function messageReady(message: MessageConfig, table: Table): boolean {
    switch (message.type) {
        case 'text':
            return sourceReady(message.text, table);
        case 'file':
            return sourceReady(message.file, table);
        case 'location':
            return sourceReady(message.latitude, table) && sourceReady(message.longitude, table);
        case 'contact':
            return sourceReady(message.phone, table);
        case 'poll':
            return sourceReady(message.question, table) && message.options.filter(o => o.trim()).length >= 2;
        case 'buttons':
            return sourceReady(message.body, table) && message.buttons.length > 0 && message.buttons.every(b => b.text.trim());
    }
}

export function mappingProblem(table: Table | null, mapping: MappingConfig): string | null {
    if (!mapping.tableId) {
        return 'Choose the table to send from.';
    }
    if (!table) {
        return 'The mapped table no longer exists — choose another.';
    }
    if (!mapping.phoneFieldId) {
        return 'Choose the recipient phone field.';
    }
    if (!table.getFieldByIdIfExists(mapping.phoneFieldId)) {
        return 'The recipient phone field no longer exists — choose another.';
    }
    if (!messageReady(mapping.message, table)) {
        switch (mapping.message.type) {
            case 'text':
                return 'Under “Message type”, choose the field to send or write a template.';
            case 'file':
                return 'Under “Message type”, choose the attachment field or enter a file URL.';
            case 'location':
                return 'Under “Message type”, set the latitude and longitude.';
            case 'contact':
                return 'Under “Message type”, set the contact phone.';
            case 'poll':
                return 'Under “Message type”, fill in the poll question and at least two options.';
            case 'buttons':
                return 'Under “Message type”, fill in the body and give every button a text.';
        }
    }
    return null;
}

export function resolveMapping(table: Table | null, mapping: MappingConfig): ResolvedMapping | null {
    if (!table || !mapping.phoneFieldId) {
        return null;
    }
    const phoneField = table.getFieldByIdIfExists(mapping.phoneFieldId);
    if (!phoneField || !messageReady(mapping.message, table)) {
        return null;
    }
    return {
        table,
        phoneField,
        message: mapping.message,
        statusField: fieldById(table, mapping.writeBack.statusFieldId),
        idMessageField: fieldById(table, mapping.writeBack.idMessageFieldId),
        sentAtField: fieldById(table, mapping.writeBack.sentAtFieldId),
        checkField: fieldById(table, mapping.writeBack.checkFieldId),
        chatIdField: fieldById(table, mapping.writeBack.chatIdFieldId),
    };
}

export function fieldsToLoad(mapping: ResolvedMapping): Field[] {
    const {table, message} = mapping;
    const fields: Field[] = [mapping.phoneField];
    switch (message.type) {
        case 'text':
            fields.push(...sourceFields(message.text, table));
            break;
        case 'file':
            fields.push(...sourceFields(message.file, table), ...sourceFields(message.caption, table));
            break;
        case 'location':
            fields.push(...sourceFields(message.latitude, table), ...sourceFields(message.longitude, table), ...sourceFields(message.name, table), ...sourceFields(message.address, table));
            break;
        case 'contact':
            fields.push(...sourceFields(message.phone, table), ...sourceFields(message.firstName, table), ...sourceFields(message.lastName, table), ...sourceFields(message.company, table));
            break;
        case 'poll':
            fields.push(...sourceFields(message.question, table));
            break;
        case 'buttons':
            fields.push(...sourceFields(message.header, table), ...sourceFields(message.body, table), ...sourceFields(message.footer, table));
            message.buttons.forEach(button => fields.push(...sourceFields(button.value, table)));
            break;
    }
    return [...new Set(fields)];
}

interface Rendered {
    text: string;
    unknown: string[];
}

function renderSource(source: TextSource | null, record: Record, table: Table): Rendered {
    if (!source) {
        return {text: '', unknown: []};
    }
    if (source.mode === 'template') {
        return renderTemplate(source.template, record, table);
    }
    const field = fieldById(table, source.fieldId);
    return {text: field ? record.getCellValueAsString(field) : '', unknown: []};
}

function renderNumber(source: TextSource, record: Record, table: Table): number | null {
    const field = source.mode === 'field' ? fieldById(table, source.fieldId) : null;
    const raw = field ? record.getCellValue(field) : null;
    const parsed = typeof raw === 'number' ? raw : Number(renderSource(source, record, table).text.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function fileNameFromUrl(url: string): string {
    try {
        const last = new URL(url).pathname.split('/').filter(Boolean).pop();
        return last ? decodeURIComponent(last) : DEFAULT_FILE_NAME;
    } catch {
        return DEFAULT_FILE_NAME;
    }
}

function renderFile(source: TextSource, record: Record, table: Table): {file: {url: string; filename: string} | null; unknown: string[]} {
    const field = source.mode === 'field' ? fieldById(table, source.fieldId) : null;
    if (field && field.type === FieldType.MULTIPLE_ATTACHMENTS) {
        const value = record.getCellValue(field) as Array<{url: string; filename: string}> | null;
        return {file: value && value.length > 0 ? value[0] : null, unknown: []};
    }
    const rendered = renderSource(source, record, table);
    const url = rendered.text.trim();
    return {file: FILE_URL.test(url) ? {url, filename: fileNameFromUrl(url)} : null, unknown: rendered.unknown};
}

function renderButton(button: ButtonConfig, record: Record, table: Table): {text: string; value: string; unknown: string[]} {
    const value = renderSource(button.value, record, table);
    return {text: button.text, value: value.text, unknown: value.unknown};
}

interface Built {
    payload: OutboundPayload | null;
    summary: string;
    problem: string | null;
    unknown: string[];
}

function buildPayload(record: Record, mapping: ResolvedMapping): Built {
    const {table, message} = mapping;
    switch (message.type) {
        case 'text': {
            const text = renderSource(message.text, record, table);
            return text.text.trim()
                ? {payload: {type: 'text', text: text.text}, summary: text.text, problem: null, unknown: text.unknown}
                : {payload: null, summary: '', problem: 'empty message', unknown: text.unknown};
        }
        case 'file': {
            const {file, unknown} = renderFile(message.file, record, table);
            const caption = renderSource(message.caption, record, table);
            return file
                ? {payload: {type: 'file', url: file.url, fileName: file.filename, caption: caption.text || undefined}, summary: `📎 ${file.filename}${caption.text ? ` — ${caption.text}` : ''}`, problem: null, unknown: [...unknown, ...caption.unknown]}
                : {payload: null, summary: '', problem: message.file.mode === 'field' ? 'no attachment' : 'invalid file URL', unknown: [...unknown, ...caption.unknown]};
        }
        case 'location': {
            const latitude = renderNumber(message.latitude, record, table);
            const longitude = renderNumber(message.longitude, record, table);
            const name = renderSource(message.name, record, table);
            const address = renderSource(message.address, record, table);
            const unknown = [...name.unknown, ...address.unknown];
            if (latitude === null || longitude === null) {
                return {payload: null, summary: '', problem: 'missing coordinates', unknown};
            }
            return {
                payload: {type: 'location', latitude, longitude, name: name.text || undefined, address: address.text || undefined},
                summary: `📍 ${name.text || address.text || `${latitude}, ${longitude}`}`,
                problem: null,
                unknown,
            };
        }
        case 'contact': {
            const phone = renderSource(message.phone, record, table);
            const firstName = renderSource(message.firstName, record, table);
            const lastName = renderSource(message.lastName, record, table);
            const company = renderSource(message.company, record, table);
            const unknown = [...phone.unknown, ...firstName.unknown, ...lastName.unknown, ...company.unknown];
            if (!phone.text.replace(/\D/g, '')) {
                return {payload: null, summary: '', problem: 'no contact phone', unknown};
            }
            return {
                payload: {type: 'contact', phone: phone.text, firstName: firstName.text || undefined, lastName: lastName.text || undefined, company: company.text || undefined},
                summary: `👤 ${[firstName.text, lastName.text].filter(Boolean).join(' ') || phone.text}`,
                problem: null,
                unknown,
            };
        }
        case 'poll': {
            const question = renderSource(message.question, record, table);
            const options = message.options.map(o => o.trim()).filter(Boolean);
            return question.text.trim() && options.length >= 2
                ? {payload: {type: 'poll', question: question.text, options, multipleAnswers: message.multipleAnswers}, summary: `📊 ${question.text} [${options.join(' / ')}]`, problem: null, unknown: question.unknown}
                : {payload: null, summary: '', problem: 'empty question', unknown: question.unknown};
        }
        case 'buttons': {
            const header = renderSource(message.header, record, table);
            const body = renderSource(message.body, record, table);
            const footer = renderSource(message.footer, record, table);
            const buttons = message.buttons.map(button => renderButton(button, record, table));
            const unknown = [...header.unknown, ...body.unknown, ...footer.unknown, ...buttons.flatMap(b => b.unknown)];
            if (!body.text.trim()) {
                return {payload: null, summary: '', problem: 'empty body', unknown};
            }
            if (buttons.some(b => !b.text.trim())) {
                return {payload: null, summary: '', problem: 'button without text', unknown};
            }
            const payloadButtons = message.buttons.map((button, i) => ({type: button.type, text: buttons[i].text, value: buttons[i].value || undefined}));
            if (payloadButtons.some(b => b.type !== 'reply' && !b.value)) {
                return {payload: null, summary: '', problem: 'button without value', unknown};
            }
            return {
                payload: {type: 'buttons', header: header.text || undefined, body: body.text, footer: footer.text || undefined, buttons: payloadButtons},
                summary: `${body.text} [${payloadButtons.map(b => b.text).join(' | ')}]`,
                problem: null,
                unknown,
            };
        }
    }
}

export function messengerProblem(payload: OutboundPayload, messenger: Messenger, chatId: string): string | null {
    if (payload.type === 'buttons' && !BUTTONS_MESSENGERS.includes(messenger)) {
        return `buttons are not supported on ${MESSENGER_LABELS[messenger]}`;
    }
    if (payload.type === 'poll' && POLL_GROUP_ONLY_MESSENGERS.includes(messenger) && !GROUP_CHAT_ID.test(chatId)) {
        return `polls go only to groups on ${MESSENGER_LABELS[messenger]}`;
    }
    if (payload.type === 'text' && payload.text.length > MESSENGER_TEXT_LIMITS[messenger]) {
        return `text exceeds ${MESSENGER_TEXT_LIMITS[messenger]} characters`;
    }
    return null;
}

export function buildPreview(records: Record[], mapping: ResolvedMapping, messenger: Messenger): PreviewRow[] {
    return records.map(record => {
        const phone = record.getCellValueAsString(mapping.phoneField);
        const chatId = previewChatId(phone, messenger);
        const built = buildPayload(record, mapping);
        const problem = !chatId ? (phone ? 'invalid phone' : 'no phone') : built.problem ?? (built.payload ? messengerProblem(built.payload, messenger, chatId) : null);
        return {
            record,
            phone,
            chatId,
            payload: problem ? null : built.payload,
            summary: built.summary,
            problem,
            unknownPlaceholders: [...new Set(built.unknown)],
        };
    });
}

export function toJobItems(rows: PreviewRow[]): JobItemInput[] {
    return rows
        .filter((row): row is PreviewRow & {payload: OutboundPayload} => row.payload !== null && row.chatId !== null)
        .map(row => ({recordId: row.record.id, phone: row.phone, payload: row.payload}));
}
