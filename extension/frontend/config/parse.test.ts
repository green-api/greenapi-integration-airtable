import {CONFIG_VERSION, DEFAULT_ADAPTER_URL} from '../defaults';
import {defaultConfig, defaultMessage, migrateConfig, stripNulls} from './parse';

describe('migrateConfig', () => {
    it('returns defaults for nothing, garbage, or another version', () => {
        expect(migrateConfig(undefined)).toEqual(defaultConfig());
        expect(migrateConfig('nope')).toEqual(defaultConfig());
        expect(migrateConfig({v: CONFIG_VERSION + 1, server: {url: 'https://elsewhere.example.com'}})).toEqual(defaultConfig());
    });

    it('keeps values written by synced pickers before any versioned write', () => {
        expect(migrateConfig({mapping: {tableId: 'tbl1'}}).mapping.tableId).toBe('tbl1');
        expect(migrateConfig({mapping: {tableId: 'tbl1'}}).server.url).toBe(DEFAULT_ADAPTER_URL);
    });

    it('fills in missing pieces and keeps what is there', () => {
        const config = migrateConfig({v: CONFIG_VERSION, mapping: {tableId: 'tblX', phoneFieldId: 'fldP'}});
        expect(config.server.url).toBe(DEFAULT_ADAPTER_URL);
        expect(config.mapping).toEqual({
            tableId: 'tblX',
            viewId: null,
            phoneFieldId: 'fldP',
            message: defaultMessage('text'),
            writeBack: {statusFieldId: null, idMessageFieldId: null, sentAtFieldId: null, checkFieldId: null, chatIdFieldId: null},
        });
    });

    it('drops empty strings and wrong types', () => {
        const config = migrateConfig({v: CONFIG_VERSION, server: {url: ''}, mapping: {tableId: 42, viewId: ''}});
        expect(config.server.url).toBe(DEFAULT_ADAPTER_URL);
        expect(config.mapping.tableId).toBeNull();
        expect(config.mapping.viewId).toBeNull();
    });

    it('falls back to a text message for an unknown message type', () => {
        expect(migrateConfig({v: CONFIG_VERSION, mapping: {message: {type: 'sticker'}}}).mapping.message).toEqual(defaultMessage('text'));
    });

    it('reads every message type with sources and optional parts', () => {
        const stored = {
            v: CONFIG_VERSION,
            mapping: {
                message: {
                    type: 'buttons',
                    header: {mode: 'template', template: 'Hi'},
                    body: {mode: 'field', fieldId: 'fldBody'},
                    footer: {mode: 'bogus'},
                    buttons: [{type: 'url', text: 'Open', value: {mode: 'template', template: 'https://example.com'}}, {type: 'teleport', text: 'x'}],
                },
            },
        };
        expect(migrateConfig(stored).mapping.message).toEqual({
            type: 'buttons',
            header: {mode: 'template', template: 'Hi'},
            body: {mode: 'field', fieldId: 'fldBody'},
            footer: null,
            buttons: [{type: 'url', text: 'Open', value: {mode: 'template', template: 'https://example.com'}}, {type: 'reply', text: 'x', value: null}],
        });
        expect(migrateConfig({v: CONFIG_VERSION, mapping: {message: {type: 'location', latitude: {mode: 'template', template: '1'}}}}).mapping.message).toEqual({
            type: 'location',
            latitude: {mode: 'template', template: '1'},
            longitude: {mode: 'field', fieldId: null},
            name: null,
            address: null,
        });
        expect(migrateConfig({v: CONFIG_VERSION, mapping: {message: {type: 'poll', options: ['a', 3]}}}).mapping.message).toEqual({
            type: 'poll',
            question: {mode: 'template', template: ''},
            options: ['a', ''],
            multipleAnswers: false,
        });
    });
});

describe('stripNulls', () => {
    it('removes null and undefined object entries recursively but keeps array slots', () => {
        expect(stripNulls({a: null, b: {c: undefined, d: 1}, e: [null, 2, {f: null}]})).toEqual({b: {d: 1}, e: [null, 2, {}]});
        expect(stripNulls(null)).toBeUndefined();
        expect(stripNulls('x')).toBe('x');
    });
});
