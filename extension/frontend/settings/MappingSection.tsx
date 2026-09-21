import {FieldPickerSynced, TablePickerSynced, ViewPickerSynced, useBase} from '@airtable/blocks/ui';
import React from 'react';
import {Card, Field, Notice} from '../components/ui';
import {configPath, GlobalConfig, writeMessage} from '../config/globalConfig';
import {GlobalConfigV1} from '../config/types';
import {CHAT_ID_FIELD_TYPES, CHECK_FIELD_TYPES, ID_MESSAGE_FIELD_TYPES, PHONE_FIELD_TYPES, SENT_AT_FIELD_TYPES, STATUS_FIELD_TYPES} from '../defaults';
import {MessageEditor} from './MessageEditor';

interface Props {
    config: GlobalConfigV1;
    globalConfig: GlobalConfig;
    canEdit: boolean;
}

export function MappingSection({config, globalConfig, canEdit}: Props) {
    const base = useBase();
    const mapping = config.mapping;
    const table = mapping.tableId ? base.getTableByIdIfExists(mapping.tableId) : null;
    const disabled = !canEdit;

    return (
        <>
            <Card title="Recipients" description="Where the people you message live, and which column holds their phone number or chat id.">
                <Field label="Table">
                    <TablePickerSynced globalConfigKey={configPath('mapping', 'tableId')} disabled={disabled} />
                </Field>
                {!table && mapping.tableId && <Notice tone="warning">The mapped table was deleted. Pick another one.</Notice>}
                {table && (
                    <>
                        <Field label="View (optional)" hint="Limits “Whole view” sends to this view.">
                            <ViewPickerSynced table={table} globalConfigKey={configPath('mapping', 'viewId')} shouldAllowPickingNone disabled={disabled} />
                        </Field>
                        <Field label="Phone field" hint="Any phone format works. For Telegram and MAX a digits-only value is treated as a chat id (as in the Chat ID column of received messages); write phone numbers with a leading + or spaces. Keep chat ids in a single line text column — Airtable’s phone number type reformats bare digits.">
                            <FieldPickerSynced table={table} globalConfigKey={configPath('mapping', 'phoneFieldId')} allowedTypes={PHONE_FIELD_TYPES} disabled={disabled} />
                        </Field>
                    </>
                )}
            </Card>
            {table && (
                <>
                    <Card title="Message" description="What each recipient gets. Templates can reference any field with {Field name}.">
                        <MessageEditor table={table} message={mapping.message} onChange={message => void writeMessage(globalConfig, message)} disabled={disabled} />
                    </Card>
                    <Card
                        title="Columns the extension fills in"
                        description="All optional. Status follows each message through sent → delivered → read (or failed); a single select gets its options added automatically, a text field also records failure reasons. The check and chat-id columns are used by Tools → Check numbers."
                    >
                        <Field label="Status field">
                            <FieldPickerSynced table={table} globalConfigKey={configPath('mapping', 'writeBack', 'statusFieldId')} allowedTypes={STATUS_FIELD_TYPES} shouldAllowPickingNone disabled={disabled} />
                        </Field>
                        <Field label="Message ID field">
                            <FieldPickerSynced table={table} globalConfigKey={configPath('mapping', 'writeBack', 'idMessageFieldId')} allowedTypes={ID_MESSAGE_FIELD_TYPES} shouldAllowPickingNone disabled={disabled} />
                        </Field>
                        <Field label="Timestamp field" hint="Set to the moment the message is accepted for sending.">
                            <FieldPickerSynced table={table} globalConfigKey={configPath('mapping', 'writeBack', 'sentAtFieldId')} allowedTypes={SENT_AT_FIELD_TYPES} shouldAllowPickingNone disabled={disabled} />
                        </Field>
                        <Field label="Account check field" hint="Checkbox, single select (yes / no) or text.">
                            <FieldPickerSynced table={table} globalConfigKey={configPath('mapping', 'writeBack', 'checkFieldId')} allowedTypes={CHECK_FIELD_TYPES} shouldAllowPickingNone disabled={disabled} />
                        </Field>
                        <Field label="Chat ID field" hint="Telegram / MAX only: the chat id found for the phone is written here, so it can be used as the recipient later.">
                            <FieldPickerSynced table={table} globalConfigKey={configPath('mapping', 'writeBack', 'chatIdFieldId')} allowedTypes={CHAT_ID_FIELD_TYPES} shouldAllowPickingNone disabled={disabled} />
                        </Field>
                    </Card>
                </>
            )}
        </>
    );
}
