import {Base, FieldType, Table} from '@airtable/blocks/models';
import {InboundFieldMap} from '../api/types';
import {MESSAGES_TABLE_NAME} from '../defaults';

type FieldSpec = {key: keyof InboundFieldMap; name: string; type: FieldType; options?: Record<string, unknown>};

const SPEC: FieldSpec[] = [
    {key: 'idMessage', name: 'Message ID', type: FieldType.SINGLE_LINE_TEXT},
    {key: 'direction', name: 'Direction', type: FieldType.SINGLE_SELECT, options: {choices: [{name: 'incoming'}, {name: 'outgoing'}]}},
    {key: 'chatId', name: 'Chat ID', type: FieldType.SINGLE_LINE_TEXT},
    {key: 'senderName', name: 'Sender', type: FieldType.SINGLE_LINE_TEXT},
    {key: 'type', name: 'Type', type: FieldType.SINGLE_SELECT, options: {choices: ['text', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'contact', 'contacts', 'poll', 'pollUpdate', 'reaction', 'edited', 'deleted', 'buttons', 'buttonsReply', 'list', 'template', 'groupInvite'].map(name => ({name}))}},
    {key: 'text', name: 'Text', type: FieldType.MULTILINE_TEXT},
    {key: 'attachments', name: 'Attachments', type: FieldType.MULTIPLE_ATTACHMENTS},
    {key: 'timestamp', name: 'Timestamp', type: FieldType.DATE_TIME, options: {dateFormat: {name: 'iso'}, timeFormat: {name: '24hour'}, timeZone: 'client'}},
    {key: 'status', name: 'Status', type: FieldType.SINGLE_SELECT, options: {choices: ['sent', 'delivered', 'read', 'failed', 'noAccount', 'notInGroup', 'yellowCard'].map(name => ({name}))}},
    {key: 'instance', name: 'Instance', type: FieldType.SINGLE_LINE_TEXT},
    {key: 'quotedMessageId', name: 'Quoted message ID', type: FieldType.SINGLE_LINE_TEXT},
    {key: 'location', name: 'Location', type: FieldType.URL},
    {key: 'details', name: 'Details', type: FieldType.MULTILINE_TEXT},
];

export function messagesTableFields(contactTableId: string | null) {
    const fields = SPEC.map(({name, type, options}) => ({name, type, options}));
    if (contactTableId) {
        fields.splice(4, 0, {name: 'Contact', type: FieldType.MULTIPLE_RECORD_LINKS, options: {linkedTableId: contactTableId}});
    }
    return fields;
}

export function canCreateMessagesTable(base: Base, contactTableId: string | null): boolean {
    return base.hasPermissionToCreateTable(MESSAGES_TABLE_NAME, messagesTableFields(contactTableId));
}

export async function createMessagesTable(base: Base, contactTableId: string | null): Promise<Table> {
    const name = base.getTableByNameIfExists(MESSAGES_TABLE_NAME) ? `${MESSAGES_TABLE_NAME} ${Date.now() % 10000}` : MESSAGES_TABLE_NAME;
    return base.createTableAsync(name, messagesTableFields(contactTableId));
}

const COMPATIBLE: Record<keyof InboundFieldMap, FieldType[]> = {
    idMessage: [FieldType.SINGLE_LINE_TEXT],
    direction: [FieldType.SINGLE_SELECT, FieldType.SINGLE_LINE_TEXT],
    chatId: [FieldType.SINGLE_LINE_TEXT],
    senderName: [FieldType.SINGLE_LINE_TEXT],
    contact: [FieldType.MULTIPLE_RECORD_LINKS],
    type: [FieldType.SINGLE_SELECT, FieldType.SINGLE_LINE_TEXT],
    text: [FieldType.MULTILINE_TEXT, FieldType.SINGLE_LINE_TEXT, FieldType.RICH_TEXT],
    attachments: [FieldType.MULTIPLE_ATTACHMENTS],
    timestamp: [FieldType.DATE_TIME, FieldType.DATE],
    status: [FieldType.SINGLE_SELECT, FieldType.SINGLE_LINE_TEXT],
    instance: [FieldType.SINGLE_LINE_TEXT, FieldType.NUMBER],
    quotedMessageId: [FieldType.SINGLE_LINE_TEXT],
    location: [FieldType.URL, FieldType.SINGLE_LINE_TEXT],
    details: [FieldType.MULTILINE_TEXT, FieldType.SINGLE_LINE_TEXT],
};

export const INBOUND_FIELD_LABELS: Record<keyof InboundFieldMap, string> = {
    idMessage: 'Message ID (required)',
    direction: 'Direction',
    chatId: 'Chat ID',
    senderName: 'Sender name',
    contact: 'Contact (link)',
    type: 'Type',
    text: 'Text',
    attachments: 'Attachments',
    timestamp: 'Timestamp',
    status: 'Status',
    instance: 'Instance',
    quotedMessageId: 'Quoted message ID',
    location: 'Location (map link)',
    details: 'Details (JSON)',
};

export const INBOUND_FIELD_KEYS = Object.keys(INBOUND_FIELD_LABELS) as Array<keyof InboundFieldMap>;

export function allowedTypesFor(key: keyof InboundFieldMap): FieldType[] {
    return COMPATIBLE[key];
}

export function autoMap(table: Table): InboundFieldMap {
    const map: InboundFieldMap = {};
    for (const spec of SPEC) {
        const field = table.getFieldByNameIfExists(spec.name);
        if (field && COMPATIBLE[spec.key].includes(field.type)) {
            map[spec.key] = field.id;
        }
    }
    const contact = table.getFieldByNameIfExists('Contact');
    if (contact && contact.type === FieldType.MULTIPLE_RECORD_LINKS) {
        map.contact = contact.id;
    }
    return map;
}
