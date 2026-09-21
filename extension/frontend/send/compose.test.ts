import {FieldType, Record, Table} from '@airtable/blocks/models';
import {MappingConfig, MessageConfig} from '../config/types';
import {defaultConfig} from '../config/parse';
import {buildPreview, fieldsToLoad, mappingProblem, messageReady, previewChatId, renderTemplate, resolveMapping, templatePlaceholders, toJobItems} from './compose';

interface FakeField {
    id: string;
    name: string;
    type: FieldType;
}

const FIELDS: FakeField[] = [
    {id: 'fldName', name: 'Name', type: FieldType.SINGLE_LINE_TEXT},
    {id: 'fldPhone', name: 'Phone', type: FieldType.PHONE_NUMBER},
    {id: 'fldMsg', name: 'Message', type: FieldType.MULTILINE_TEXT},
    {id: 'fldFiles', name: 'Files', type: FieldType.MULTIPLE_ATTACHMENTS},
    {id: 'fldLink', name: 'Link', type: FieldType.URL},
    {id: 'fldLat', name: 'Lat', type: FieldType.NUMBER},
    {id: 'fldLng', name: 'Lng', type: FieldType.NUMBER},
    {id: 'fldStatus', name: 'Status', type: FieldType.SINGLE_SELECT},
];

function fakeTable(): Table {
    return {
        id: 'tblFake',
        fields: FIELDS,
        getFieldByIdIfExists: (id: string) => FIELDS.find(f => f.id === id) ?? null,
        getFieldByNameIfExists: (name: string) => FIELDS.find(f => f.name === name) ?? null,
    } as unknown as Table;
}

function fakeRecord(id: string, cells: {[fieldId: string]: unknown}): Record {
    const asString = (value: unknown): string => {
        if (value === null || value === undefined) {
            return '';
        }
        if (Array.isArray(value)) {
            return value.map(v => (typeof v === 'object' && v && 'filename' in v ? (v as {filename: string}).filename : String(v))).join(', ');
        }
        return String(value);
    };
    return {
        id,
        getCellValue: (field: FakeField) => cells[field.id] ?? null,
        getCellValueAsString: (field: FakeField) => asString(cells[field.id]),
    } as unknown as Record;
}

const table = fakeTable();
const ann = fakeRecord('recAnn00000000001', {fldName: 'Ann', fldPhone: '+1 (212) 555-0123', fldMsg: 'Hi Ann', fldFiles: [{url: 'https://dl.example.com/a.pdf', filename: 'a.pdf'}], fldLink: 'https://cdn.example.com/x.png', fldLat: 51.5, fldLng: -0.12});
const noPhone = fakeRecord('recNoPhone0000001', {fldName: 'Bob', fldMsg: 'Hi Bob'});
const badPhone = fakeRecord('recBadPhone000001', {fldName: 'Cy', fldPhone: '12', fldMsg: 'Hi Cy'});

function mapping(message: MessageConfig, extra: Partial<MappingConfig> = {}): MappingConfig {
    return {...defaultConfig().mapping, tableId: 'tblFake', phoneFieldId: 'fldPhone', message, ...extra};
}

function resolved(message: MessageConfig, extra: Partial<MappingConfig> = {}) {
    const result = resolveMapping(table, mapping(message, extra));
    if (!result) {
        throw new Error('mapping did not resolve');
    }
    return result;
}

describe('previewChatId', () => {
    it('normalises phones and keeps group ids on WhatsApp', () => {
        expect(previewChatId('+1 (212) 555-0123', 'whatsapp')).toBe('12125550123@c.us');
        expect(previewChatId('120363012345678901@g.us', 'whatsapp')).toBe('120363012345678901@g.us');
        expect(previewChatId('-10000000000000', 'whatsapp')).toBe('10000000000000@c.us');
        expect(previewChatId('12', 'whatsapp')).toBeNull();
        expect(previewChatId('', 'whatsapp')).toBeNull();
    });

    it.each(['telegram', 'max'] as const)('keeps chat ids and normalises formatted phones on %s', messenger => {
        expect(previewChatId('10000000', messenger)).toBe('10000000');
        expect(previewChatId('-10000000000000', messenger)).toBe('-10000000000000');
        expect(previewChatId('12125550123@c.us', messenger)).toBe('12125550123@c.us');
        expect(previewChatId('+1 (212) 555-0123', messenger)).toBe('12125550123@c.us');
        expect(previewChatId('120363012345678901@g.us', messenger)).toBeNull();
    });
});

describe('templates', () => {
    it('lists unique placeholders, trimmed', () => {
        expect(templatePlaceholders('Hi {Name}, {Name}! Order { Order }')).toEqual(['Name', 'Order']);
    });

    it('substitutes known fields and reports unknown ones untouched', () => {
        expect(renderTemplate('Hi {Name}, see {Nope}', ann, table)).toEqual({text: 'Hi Ann, see {Nope}', unknown: ['Nope']});
    });
});

describe('mappingProblem / messageReady', () => {
    it('walks the setup in order', () => {
        expect(mappingProblem(null, {...defaultConfig().mapping})).toBe('Choose the table to send from.');
        expect(mappingProblem(null, mapping(defaultConfig().mapping.message))).toContain('no longer exists');
        expect(mappingProblem(table, mapping(defaultConfig().mapping.message, {phoneFieldId: null}))).toBe('Choose the recipient phone field.');
        expect(mappingProblem(table, mapping(defaultConfig().mapping.message, {phoneFieldId: 'fldGone'}))).toContain('phone field no longer exists');
        expect(mappingProblem(table, mapping({type: 'text', text: {mode: 'field', fieldId: null}}))).toContain('choose the field to send');
        expect(mappingProblem(table, mapping({type: 'text', text: {mode: 'field', fieldId: 'fldMsg'}}))).toBeNull();
    });

    it('treats a blank template as not ready', () => {
        expect(messageReady({type: 'text', text: {mode: 'template', template: '   '}}, table)).toBe(false);
        expect(messageReady({type: 'text', text: {mode: 'template', template: 'x'}}, table)).toBe(true);
    });

    it('requires both coordinates, a poll question with two options, and every button to have text', () => {
        expect(messageReady({type: 'location', latitude: {mode: 'template', template: '1'}, longitude: {mode: 'field', fieldId: null}, name: null, address: null}, table)).toBe(false);
        expect(messageReady({type: 'poll', question: {mode: 'template', template: 'Tea?'}, options: ['yes', ' '], multipleAnswers: false}, table)).toBe(false);
        expect(messageReady({type: 'buttons', header: null, body: {mode: 'template', template: 'Pick'}, footer: null, buttons: [{type: 'reply', text: '', value: null}]}, table)).toBe(false);
    });
});

describe('buildPreview', () => {
    it('renders text from a field and flags rows without a usable phone', () => {
        const rows = buildPreview([ann, noPhone, badPhone], resolved({type: 'text', text: {mode: 'field', fieldId: 'fldMsg'}}), 'whatsapp');
        expect(rows.map(r => r.problem)).toEqual([null, 'no phone', 'invalid phone']);
        expect(rows[0].chatId).toBe('12125550123@c.us');
        expect(rows[0].payload).toEqual({type: 'text', text: 'Hi Ann'});
    });

    it('renders a template with unknown placeholders reported per row', () => {
        const [row] = buildPreview([ann], resolved({type: 'text', text: {mode: 'template', template: 'Hi {Name} {Missing}'}}), 'whatsapp');
        expect(row.payload).toEqual({type: 'text', text: 'Hi Ann {Missing}'});
        expect(row.unknownPlaceholders).toEqual(['Missing']);
    });

    it('sends the first attachment of an attachment field', () => {
        const [row] = buildPreview([ann], resolved({type: 'file', file: {mode: 'field', fieldId: 'fldFiles'}, caption: {mode: 'template', template: 'For {Name}'}}), 'whatsapp');
        expect(row.payload).toEqual({type: 'file', url: 'https://dl.example.com/a.pdf', fileName: 'a.pdf', caption: 'For Ann'});
        expect(buildPreview([noPhone], resolved({type: 'file', file: {mode: 'field', fieldId: 'fldFiles'}, caption: null}), 'whatsapp')[0].problem).toBe('no phone');
    });

    it('accepts a url field or a fixed url and names the file from the path', () => {
        const fromField = buildPreview([ann], resolved({type: 'file', file: {mode: 'field', fieldId: 'fldLink'}, caption: null}), 'whatsapp')[0];
        expect(fromField.payload).toEqual({type: 'file', url: 'https://cdn.example.com/x.png', fileName: 'x.png', caption: undefined});
        const fixed = buildPreview([ann], resolved({type: 'file', file: {mode: 'template', template: 'https://cdn.example.com/docs/{Name}%20v2.pdf'}, caption: null}), 'whatsapp')[0];
        expect(fixed.payload).toEqual({type: 'file', url: 'https://cdn.example.com/docs/Ann%20v2.pdf', fileName: 'Ann v2.pdf', caption: undefined});
        const bare = buildPreview([ann], resolved({type: 'file', file: {mode: 'template', template: 'https://cdn.example.com'}, caption: null}), 'whatsapp')[0];
        expect(bare.payload).toMatchObject({fileName: 'file'});
        const invalid = buildPreview([ann], resolved({type: 'file', file: {mode: 'template', template: 'ftp://cdn.example.com/x'}, caption: null}), 'whatsapp')[0];
        expect(invalid.problem).toBe('invalid file URL');
    });

    it('reads coordinates from number fields or fixed values with a decimal comma', () => {
        const fromFields = buildPreview([ann], resolved({type: 'location', latitude: {mode: 'field', fieldId: 'fldLat'}, longitude: {mode: 'field', fieldId: 'fldLng'}, name: {mode: 'template', template: '{Name}’s pin'}, address: null}), 'whatsapp')[0];
        expect(fromFields.payload).toEqual({type: 'location', latitude: 51.5, longitude: -0.12, name: 'Ann’s pin', address: undefined});
        const fixed = buildPreview([ann], resolved({type: 'location', latitude: {mode: 'template', template: '43,25'}, longitude: {mode: 'template', template: '76.95'}, name: null, address: {mode: 'template', template: 'HQ'}}), 'whatsapp')[0];
        expect(fixed.payload).toEqual({type: 'location', latitude: 43.25, longitude: 76.95, name: undefined, address: 'HQ'});
        expect(fixed.summary).toBe('📍 HQ');
        const missing = buildPreview([noPhone], resolved({type: 'location', latitude: {mode: 'field', fieldId: 'fldLat'}, longitude: {mode: 'field', fieldId: 'fldLng'}, name: null, address: null}), 'whatsapp')[0];
        expect(missing.problem).toBe('no phone');
    });

    it('builds a contact card from fixed values', () => {
        const [row] = buildPreview([ann], resolved({type: 'contact', phone: {mode: 'template', template: '+1 212 555 0100'}, firstName: {mode: 'template', template: 'Sam'}, lastName: null, company: {mode: 'template', template: 'Example Ltd'}}), 'whatsapp');
        expect(row.payload).toEqual({type: 'contact', phone: '+1 212 555 0100', firstName: 'Sam', lastName: undefined, company: 'Example Ltd'});
        expect(row.summary).toBe('👤 Sam');
    });

    it('drops blank poll options and requires two', () => {
        const [row] = buildPreview([ann], resolved({type: 'poll', question: {mode: 'template', template: 'Tea, {Name}?'}, options: ['yes', ' ', 'no'], multipleAnswers: true}), 'whatsapp');
        expect(row.payload).toEqual({type: 'poll', question: 'Tea, Ann?', options: ['yes', 'no'], multipleAnswers: true});
    });

    it('renders buttons and refuses an action button without a value', () => {
        const ok = buildPreview([ann], resolved({type: 'buttons', header: null, body: {mode: 'template', template: 'Pick'}, footer: null, buttons: [{type: 'url', text: 'Open', value: {mode: 'template', template: 'https://example.com/{Name}'}}]}), 'whatsapp')[0];
        expect(ok.payload).toEqual({type: 'buttons', header: undefined, body: 'Pick', footer: undefined, buttons: [{type: 'url', text: 'Open', value: 'https://example.com/Ann'}]});
        const noValue = buildPreview([ann], resolved({type: 'buttons', header: null, body: {mode: 'template', template: 'Pick'}, footer: null, buttons: [{type: 'url', text: 'Open', value: null}]}), 'whatsapp')[0];
        expect(noValue.problem).toBe('button without value');
    });
});

describe('buildPreview per messenger', () => {
    it('skips buttons on Telegram and MAX but not on WhatsApp', () => {
        const message: MessageConfig = {type: 'buttons', header: null, body: {mode: 'template', template: 'Pick'}, footer: null, buttons: [{type: 'reply', text: 'A', value: null}]};
        expect(buildPreview([ann], resolved(message), 'whatsapp')[0].payload).not.toBeNull();
        const telegram = buildPreview([ann], resolved(message), 'telegram')[0];
        expect(telegram.payload).toBeNull();
        expect(telegram.problem).toBe('buttons are not supported on Telegram');
        expect(buildPreview([ann], resolved(message), 'max')[0].problem).toBe('buttons are not supported on MAX');
    });

    it('applies the text limit of the messenger', () => {
        const long = fakeRecord('recLong0000000001', {fldPhone: '+1 212 555 0123', fldMsg: 'x'.repeat(4001)});
        const message: MessageConfig = {type: 'text', text: {mode: 'field', fieldId: 'fldMsg'}};
        expect(buildPreview([long], resolved(message), 'whatsapp')[0].problem).toBeNull();
        expect(buildPreview([long], resolved(message), 'telegram')[0].problem).toBeNull();
        expect(buildPreview([long], resolved(message), 'max')[0].problem).toBe('text exceeds 4000 characters');
    });

    it('sends Telegram polls only to groups', () => {
        const message: MessageConfig = {type: 'poll', question: {mode: 'template', template: '123'}, options: ['1', '2'], multipleAnswers: false};
        const personal = fakeRecord('recPoll00000000001', {fldPhone: '10000000', fldMsg: ''});
        const group = fakeRecord('recPoll00000000002', {fldPhone: '-10000000000000', fldMsg: ''});
        expect(buildPreview([personal], resolved(message), 'telegram')[0].problem).toBe('polls go only to groups on Telegram');
        expect(buildPreview([group], resolved(message), 'telegram')[0].problem).toBeNull();
        expect(buildPreview([personal], resolved(message), 'max')[0].problem).toBeNull();
        expect(buildPreview([ann], resolved(message), 'whatsapp')[0].problem).toBeNull();
    });

    it('accepts a numeric chat id only for Telegram and MAX', () => {
        const byId = fakeRecord('recById0000000001', {fldPhone: '10000000', fldMsg: 'hi'});
        const message: MessageConfig = {type: 'text', text: {mode: 'field', fieldId: 'fldMsg'}};
        expect(buildPreview([byId], resolved(message), 'telegram')[0].chatId).toBe('10000000');
        expect(buildPreview([byId], resolved(message), 'whatsapp')[0].chatId).toBe('10000000@c.us');
    });
});

describe('fieldsToLoad / toJobItems', () => {
    it('loads the phone field plus every referenced field once', () => {
        const fields = fieldsToLoad(resolved({type: 'text', text: {mode: 'template', template: '{Name} {Name} {Missing}'}}));
        expect(fields.map(f => f.id)).toEqual(['fldPhone', 'fldName']);
    });

    it('turns only sendable rows into job items', () => {
        const rows = buildPreview([ann, noPhone], resolved({type: 'text', text: {mode: 'field', fieldId: 'fldMsg'}}), 'whatsapp');
        expect(toJobItems(rows)).toEqual([{recordId: 'recAnn00000000001', phone: '+1 (212) 555-0123', payload: {type: 'text', text: 'Hi Ann'}}]);
    });
});
