import {Field, FieldType, Table} from '@airtable/blocks/models';
import {FieldPicker, Select, TablePicker, useBase} from '@airtable/blocks/ui';
import React, {useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {InstanceSummaryView} from '../api/types';
import {Card, Field as FieldRow, GhostButton, Notice, PrimaryButton} from '../components/ui';
import {CHAT_ID_FIELD_TYPES, CONTACT_IMPORT_BATCH_SIZE, PHONE_FIELD_TYPES, TEXT_LIKE_FIELD_TYPES} from '../defaults';
import {instanceLabel} from '../instances';
import {chunk} from '../send/checkNumbers';

interface Props {
    client: AdapterClient;
    instances: InstanceSummaryView[];
    canEdit: boolean;
    defaultTableId: string | null;
    defaultPhoneFieldId: string | null;
}

function digits(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
}

export function ContactsImportSection({client, instances, canEdit, defaultTableId, defaultPhoneFieldId}: Props) {
    const base = useBase();
    const [idInstance, setIdInstance] = useState<string>(instances[0] ? String(instances[0].idInstance) : '');
    const [table, setTable] = useState<Table | null>(defaultTableId ? base.getTableByIdIfExists(defaultTableId) : null);
    const [nameField, setNameField] = useState<Field | null>(null);
    const [phoneField, setPhoneField] = useState<Field | null>(table && defaultPhoneFieldId ? table.getFieldByIdIfExists(defaultPhoneFieldId) : null);
    const [chatIdField, setChatIdField] = useState<Field | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const chooseTable = (next: Table | null) => {
        setTable(next);
        setNameField(null);
        setPhoneField(null);
        setChatIdField(null);
    };

    const run = async () => {
        if (!table || !phoneField || !idInstance) {
            return;
        }
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const contacts = await client.listContacts(Number(idInstance));
            const loadFields = chatIdField ? [phoneField, chatIdField] : [phoneField];
            const existing = await table.selectRecordsAsync({fields: loadFields});
            const knownPhones = new Set(existing.records.map(record => digits(record.getCellValueAsString(phoneField))).filter(Boolean));
            const knownChatIds = new Set(chatIdField ? existing.records.map(record => record.getCellValueAsString(chatIdField).trim()).filter(Boolean) : []);
            existing.unloadData();
            const fresh = contacts.filter(contact => (contact.phone && !knownPhones.has(contact.phone)) || (!contact.phone && chatIdField && !knownChatIds.has(contact.chatId)));
            const rows = fresh.map(contact => {
                const fields: {[fieldId: string]: unknown} = {};
                if (contact.phone) {
                    fields[phoneField.id] = `+${contact.phone}`;
                }
                if (chatIdField) {
                    fields[chatIdField.id] = contact.chatId;
                }
                if (nameField) {
                    fields[nameField.id] = contact.name || contact.username || (contact.phone ? `+${contact.phone}` : contact.chatId);
                }
                return {fields};
            });
            for (const part of chunk(rows, CONTACT_IMPORT_BATCH_SIZE)) {
                await table.createRecordsAsync(part);
            }
            setNotice(`${rows.length} contact${rows.length === 1 ? '' : 's'} added to “${table.name}”; ${contacts.length - fresh.length} skipped (already there, or no phone${chatIdField ? '' : ' — map a Chat ID field to import those'}).`);
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title="Import contacts" description="Copies the messenger’s address book (name, phone, chat id) into a table. Contacts already present are skipped.">
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="success">{notice}</Notice>}
            <FieldRow label="Instance">
                <Select
                    options={instances.map(i => ({value: String(i.idInstance), label: instanceLabel(i)}))}
                    value={idInstance}
                    onChange={value => setIdInstance(String(value))}
                    disabled={!canEdit || busy || instances.length === 0}
                />
            </FieldRow>
            <FieldRow label="Into table">
                <TablePicker table={table} onChange={chooseTable} shouldAllowPickingNone disabled={!canEdit || busy} placeholder="Pick a table…" />
            </FieldRow>
            {table && (
                <>
                    <FieldRow label="Phone field">
                        <FieldPicker table={table} field={phoneField} onChange={setPhoneField} allowedTypes={PHONE_FIELD_TYPES.filter(type => type !== FieldType.FORMULA && type !== FieldType.MULTIPLE_LOOKUP_VALUES && type !== FieldType.ROLLUP)} disabled={!canEdit || busy} />
                    </FieldRow>
                    <FieldRow label="Chat ID field (optional)" hint="Telegram / MAX: contacts that hide their phone are imported by chat id into this field.">
                        <FieldPicker table={table} field={chatIdField} onChange={setChatIdField} allowedTypes={CHAT_ID_FIELD_TYPES} shouldAllowPickingNone disabled={!canEdit || busy} />
                    </FieldRow>
                    <FieldRow label="Name field (optional)">
                        <FieldPicker table={table} field={nameField} onChange={setNameField} allowedTypes={TEXT_LIKE_FIELD_TYPES.filter(type => type === FieldType.SINGLE_LINE_TEXT || type === FieldType.MULTILINE_TEXT)} shouldAllowPickingNone disabled={!canEdit || busy} />
                    </FieldRow>
                </>
            )}
            <div className="ga-row">
                <PrimaryButton onClick={() => void run()} disabled={!canEdit || busy || !table || !phoneField || !idInstance || !table.hasPermissionToCreateRecords()} icon="download">{busy ? 'Importing…' : 'Import contacts'}</PrimaryButton>
                {notice && <GhostButton onClick={() => setNotice(null)} size="small">Dismiss</GhostButton>}
            </div>
        </Card>
    );
}
