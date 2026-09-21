import {FieldType, Table} from '@airtable/blocks/models';
import {FieldPicker, Link, Switch, TablePicker, useBase} from '@airtable/blocks/ui';
import React, {useCallback, useEffect, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {BaseView, InboundConfig, InboundFieldMap, InstanceView} from '../api/types';
import {Badge, Card, Field, GhostButton, Notice, PrimaryButton} from '../components/ui';
import {CHAT_ID_FIELD_TYPES, PHONE_FIELD_TYPES} from '../defaults';
import {allowedTypesFor, autoMap, canCreateMessagesTable, createMessagesTable, INBOUND_FIELD_KEYS, INBOUND_FIELD_LABELS} from './messagesTable';
import {instanceName, MessengerBadge} from '../instances';

interface Props {
    client: AdapterClient;
    canEdit: boolean;
    instances: InstanceView[];
    onInstancesChanged: () => Promise<void>;
    contactsTableId: string | null;
}

const OAUTH_POLL_MS = 2000;
const OAUTH_POLL_LIMIT = 90;

export function InboundSection({client, canEdit, instances, onInstancesChanged, contactsTableId}: Props) {
    const base = useBase();
    const [view, setView] = useState<BaseView | null>(null);
    const [draft, setDraft] = useState<InboundConfig | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [authUrl, setAuthUrl] = useState<string | null>(null);
    const [showAllFields, setShowAllFields] = useState(false);

    const load = useCallback(async () => {
        try {
            const next = await client.me();
            setView(next);
            setDraft(next.inbound);
            setError(null);
        } catch (e) {
            setError(describeError(e));
        }
    }, [client]);

    useEffect(() => {
        void load();
    }, [load]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action();
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    };

    const connectAirtable = () => run(async () => {
        const {url} = await client.baseAuthSession();
        const popup = window.open(url, 'greenapi-airtable-oauth', 'width=600,height=720');
        setAuthUrl(popup ? null : url);
        try {
            for (let i = 0; i < OAUTH_POLL_LIMIT; i++) {
                await new Promise(resolve => setTimeout(resolve, OAUTH_POLL_MS));
                const next = await client.me();
                if (next.airtable.connected) {
                    setView(next);
                    setNotice('Airtable access granted.');
                    return;
                }
                if (popup?.closed && i > 2) {
                    break;
                }
            }
            throw new Error('Authorization was not completed. Start again.');
        } finally {
            setAuthUrl(null);
        }
    });

    const disconnectAirtable = () => run(async () => {
        await client.disconnectAirtable();
        await load();
    });

    const toggleReceive = (instance: InstanceView, receive: boolean) => run(async () => {
        await client.setReceive(instance.idInstance, receive);
        await onInstancesChanged();
    });

    const chooseTable = (table: Table | null) => {
        if (!table) {
            setDraft(null);
            return;
        }
        setDraft({tableId: table.id, fields: autoMap(table), contactLink: draft?.contactLink ?? (contactsTableId ? {tableId: contactsTableId, phoneFieldId: '', chatIdFieldId: null} : null)});
    };

    const createTable = () => run(async () => {
        const table = await createMessagesTable(base, contactsTableId);
        setDraft({tableId: table.id, fields: autoMap(table), contactLink: contactsTableId ? {tableId: contactsTableId, phoneFieldId: '', chatIdFieldId: null} : null});
        setNotice(`Table “${table.name}” created. Save to start receiving into it.`);
    });

    const save = () => run(async () => {
        if (!draft) {
            await client.clearInbound();
        } else {
            const contactLink = draft.contactLink && draft.contactLink.phoneFieldId ? draft.contactLink : null;
            await client.setInbound({...draft, contactLink});
        }
        await load();
        setNotice('Receiving settings saved.');
    });

    const table = draft?.tableId ? base.getTableByIdIfExists(draft.tableId) : null;
    const contactsTable = draft?.contactLink?.tableId ? base.getTableByIdIfExists(draft.contactLink.tableId) : null;
    const connected = view?.airtable.connected ?? false;
    const setField = (key: keyof InboundFieldMap, fieldId: string | null) => {
        if (!draft) {
            return;
        }
        const fields = {...draft.fields};
        if (fieldId) {
            fields[key] = fieldId;
        } else {
            delete fields[key];
        }
        setDraft({...draft, fields});
    };
    const dirty = JSON.stringify(draft) !== JSON.stringify(view?.inbound ?? null);
    const mappedCount = draft ? Object.keys(draft.fields).filter(k => k !== 'contact').length : 0;

    return (
        <>
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="success">{notice}</Notice>}

            <Card
                title="Airtable access for the adapter"
                description="Incoming messages and delivery statuses are written into this base by the adapter — even when nobody has it open. That needs an Airtable account with editor access; normally yours, granted when you confirmed your identity."
                action={connected ? <Badge tone="green" dot>connected</Badge> : <Badge tone="red">not connected</Badge>}
            >
                {connected ? (
                    <div className="ga-row ga-row--between">
                        <span className="ga-small ga-muted">Valid until {view?.airtable.expiresAt ? new Date(view.airtable.expiresAt).toLocaleDateString() : '—'}; renews automatically while in use.</span>
                        <GhostButton onClick={disconnectAirtable} disabled={!canEdit || busy} size="small">Disconnect</GhostButton>
                    </div>
                ) : (
                    <>
                        <PrimaryButton onClick={connectAirtable} disabled={!canEdit || busy}>{busy ? 'Waiting for Airtable…' : 'Grant access'}</PrimaryButton>
                        {authUrl && (
                            <Notice tone="warning">
                                The browser blocked the pop-up. <Link href={authUrl} target="_blank">Open the Airtable authorization page</Link>, then come back here.
                            </Notice>
                        )}
                    </>
                )}
            </Card>

            <Card title="Instances that forward to this base" description="Points the instance’s webhook at the adapter. If the instance already sends webhooks somewhere else, that stops.">
                {instances.length === 0 && <div className="ga-small ga-muted">Add an instance first.</div>}
                {instances.map(instance => (
                    <div key={instance.idInstance} className="ga-row" style={{marginBottom: 6}}>
                        <Switch value={instance.receiveWebhooks} onChange={receive => toggleReceive(instance, receive)} label={instanceName(instance)} disabled={!canEdit || busy} width="auto" />
                        <MessengerBadge messenger={instance.messenger} />
                    </div>
                ))}
            </Card>

            <Card
                title="Messages table"
                description="Where conversations land. One row per message, in or out, with attachments, type and delivery status."
                action={draft ? <Badge tone="gray">{mappedCount} columns mapped</Badge> : undefined}
            >
                <div className="ga-row" style={{marginBottom: 10}}>
                    <TablePicker table={table} onChange={chooseTable} shouldAllowPickingNone disabled={!canEdit || busy} placeholder="Pick an existing table…" />
                    <span className="ga-small ga-muted">or</span>
                    <PrimaryButton onClick={createTable} disabled={!canEdit || busy || !canCreateMessagesTable(base, contactsTableId)} size="small" icon="plus">Create table</PrimaryButton>
                </div>
                {table && draft && (
                    <>
                        <button type="button" className="ga-link ga-small" onClick={() => setShowAllFields(v => !v)}>
                            {showAllFields ? 'Hide column mapping' : 'Adjust column mapping'}
                        </button>
                        {showAllFields && (
                            <div style={{marginTop: 10}}>
                                {INBOUND_FIELD_KEYS.filter(key => key !== 'contact').map(key => (
                                    <Field key={key} label={INBOUND_FIELD_LABELS[key]}>
                                        <FieldPicker
                                            table={table}
                                            field={draft.fields[key] ? table.getFieldByIdIfExists(draft.fields[key] as string) : null}
                                            onChange={field => setField(key, field?.id ?? null)}
                                            allowedTypes={allowedTypesFor(key)}
                                            shouldAllowPickingNone
                                            disabled={!canEdit || busy}
                                            size="small"
                                        />
                                    </Field>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </Card>

            {table && draft && (
                <Card title="Link messages to contacts" description="Optional. Each message row gets linked to the contact whose phone or chat id matches.">
                    <Field label="Contacts table">
                        <TablePicker
                            table={contactsTable}
                            onChange={t => setDraft({...draft, contactLink: t ? {tableId: t.id, phoneFieldId: '', chatIdFieldId: null} : null})}
                            shouldAllowPickingNone
                            disabled={!canEdit || busy}
                        />
                    </Field>
                    {contactsTable && (
                        <>
                            <Field label="Phone field in contacts table">
                                <FieldPicker
                                    table={contactsTable}
                                    field={draft.contactLink?.phoneFieldId ? contactsTable.getFieldByIdIfExists(draft.contactLink.phoneFieldId) : null}
                                    onChange={field => setDraft({...draft, contactLink: {tableId: contactsTable.id, phoneFieldId: field?.id ?? '', chatIdFieldId: draft.contactLink?.chatIdFieldId ?? null}})}
                                    allowedTypes={PHONE_FIELD_TYPES}
                                    disabled={!canEdit || busy}
                                />
                            </Field>
                            <Field label="Chat ID field in contacts table (optional)" hint="Telegram and MAX identify people by chat id, not phone. Tools → Check numbers fills this column; without it, their messages link only when the messenger knows the sender’s phone.">
                                <FieldPicker
                                    table={contactsTable}
                                    field={draft.contactLink?.chatIdFieldId ? contactsTable.getFieldByIdIfExists(draft.contactLink.chatIdFieldId) : null}
                                    onChange={field => setDraft({...draft, contactLink: {tableId: contactsTable.id, phoneFieldId: draft.contactLink?.phoneFieldId ?? '', chatIdFieldId: field?.id ?? null}})}
                                    allowedTypes={CHAT_ID_FIELD_TYPES}
                                    shouldAllowPickingNone
                                    disabled={!canEdit || busy}
                                />
                            </Field>
                            <Field label="Link field in messages table" hint="Must link to the contacts table.">
                                <FieldPicker
                                    table={table}
                                    field={draft.fields.contact ? table.getFieldByIdIfExists(draft.fields.contact) : null}
                                    onChange={field => setField('contact', field?.id ?? null)}
                                    allowedTypes={[FieldType.MULTIPLE_RECORD_LINKS]}
                                    shouldAllowPickingNone
                                    disabled={!canEdit || busy}
                                />
                            </Field>
                        </>
                    )}
                </Card>
            )}

            <div className="ga-row">
                <PrimaryButton onClick={save} disabled={!canEdit || busy || !dirty || (draft !== null && !draft.fields.idMessage)}>Save receiving settings</PrimaryButton>
                {draft && !draft.fields.idMessage && (
                    <span className="ga-small" style={{color: 'var(--ga-amber)'}}>
                        Map the Message ID column first — it is how delivery statuses find their row and re-delivered messages are recognised.{' '}
                        <button type="button" className="ga-link" onClick={() => setShowAllFields(true)}>Adjust column mapping</button>
                    </span>
                )}
                {!connected && draft && <span className="ga-small" style={{color: 'var(--ga-amber)'}}>Rows are written only once Airtable access is granted.</span>}
            </div>
        </>
    );
}
