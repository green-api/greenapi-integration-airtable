import {cursor} from '@airtable/blocks';
import {Field, Record, Table} from '@airtable/blocks/models';
import {Select, useLoadable, useRecords, useWatchable} from '@airtable/blocks/ui';
import React, {useMemo, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {InstanceSummaryView} from '../api/types';
import {Badge, Card, GhostButton, Notice, PrimaryButton, Shell} from '../components/ui';
import {GlobalConfigV1} from '../config/types';
import {CHAT_HISTORY_COUNT, HISTORY_DEFAULT_MINUTES, HISTORY_WINDOWS, MESSENGER_LABELS} from '../defaults';
import {instanceLabel} from '../instances';
import {buildPreview, fieldsToLoad, PreviewRow, ResolvedMapping} from '../send/compose';
import {checkAndWrite} from '../send/checkNumbers';
import {AutomationSection} from '../settings/AutomationSection';
import {ContactsImportSection} from '../settings/ContactsImportSection';
import {SettingsTab} from '../settings/SettingsScreen';

interface Props {
    header: React.ReactNode;
    nav: React.ReactNode;
    client: AdapterClient;
    instance: InstanceSummaryView | null;
    instances: InstanceSummaryView[];
    mapping: ResolvedMapping | null;
    config: GlobalConfigV1;
    inboundConfigured: boolean;
    isAdmin: boolean;
    canEditConfig: boolean;
    onOpenSettings: (tab: SettingsTab) => void;
}

function Reason({children}: {children: React.ReactNode}) {
    return <div className="ga-small ga-muted" style={{marginTop: 6}}>{children}</div>;
}

export function ToolsScreen({header, nav, client, instance, instances, mapping, config, inboundConfigured, isAdmin, canEditConfig, onOpenSettings}: Props) {
    useLoadable(cursor);
    useWatchable(cursor, ['selectedRecordIds', 'activeTableId']);
    const table = mapping?.table ?? null;
    const loaded = useRecords(table as Table, mapping ? {fields: fieldsToLoad(mapping)} : undefined) as Record[] | null;
    const selectedIds = cursor.selectedRecordIds;
    const activeTableId = cursor.activeTableId;
    const selected: Record[] = useMemo(
        () => (table && loaded && activeTableId === table.id ? loaded.filter(r => selectedIds.includes(r.id)) : []),
        [table, activeTableId, loaded, selectedIds],
    );
    const rows: PreviewRow[] = useMemo(() => (mapping && instance ? buildPreview(selected, mapping, instance.messenger) : []), [selected, mapping, instance]);

    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<{tool: string; text: string; tone: 'success' | 'error'} | null>(null);
    const [historyInstance, setHistoryInstance] = useState<string>('');
    const [historyMinutes, setHistoryMinutes] = useState<number>(HISTORY_DEFAULT_MINUTES);

    const run = async (tool: string, action: () => Promise<string>) => {
        setBusy(tool);
        setNotice(null);
        try {
            setNotice({tool, text: await action(), tone: 'success'});
        } catch (e) {
            setNotice({tool, text: describeError(e), tone: 'error'});
        } finally {
            setBusy(null);
        }
    };

    const checkNumbers = () => run('check', async () => {
        if (!mapping || !instance) {
            return '';
        }
        const targets = rows.filter(row => row.phone.trim()).map(row => ({record: row.record, phone: row.phone}));
        const summary = await checkAndWrite(mapping.table, mapping.checkField as Field, mapping.chatIdField, targets, phones => client.checkNumbers(instance.idInstance, phones));
        const parts = [`${summary.found} of ${summary.checked} have ${MESSENGER_LABELS[instance.messenger]}`];
        if (summary.failed > 0) {
            parts.push(`${summary.failed} could not be checked`);
        }
        if (summary.unwritable.length > 0) {
            parts.push(`“${mapping.checkField?.name}” lacks the options ${summary.unwritable.join(', ')}, nothing written`);
        }
        return parts.join(' · ');
    });

    const loadChatHistory = () => run('chat', async () => {
        if (!instance) {
            return '';
        }
        const result = await client.importChat(instance.idInstance, rows[0].phone, CHAT_HISTORY_COUNT);
        return `${result.imported} message${result.imported === 1 ? '' : 's'} added to the messages table, ${result.skipped} already there.`;
    });

    const importHistory = () => run('history', async () => {
        const idInstance = Number(historyInstance || instances[0]?.idInstance);
        const result = await client.importHistory(idInstance, historyMinutes);
        return `${result.imported} message${result.imported === 1 ? '' : 's'} added to the messages table, ${result.skipped} already there.`;
    });

    const canEditTable = mapping?.table.hasPermissionToUpdateRecords() ?? false;
    const selectionLabel = mapping
        ? cursor.activeTableId === mapping.table.id
            ? `${selected.length} row${selected.length === 1 ? '' : 's'} selected in ${mapping.table.name}`
            : `Select rows in “${mapping.table.name}”`
        : 'Set up sending first';
    const noticeFor = (tool: string) => notice?.tool === tool && <Notice tone={notice.tone}>{notice.text}</Notice>;

    return (
        <Shell header={header}>
            {nav}
            <Card
                title="Check numbers"
                description="Asks the messenger whether each selected phone has an account, and writes yes / no into a column. On Telegram and MAX it can also record the chat id."
                action={<Badge tone="gray">{selectionLabel}</Badge>}
            >
                {noticeFor('check')}
                <PrimaryButton onClick={checkNumbers} disabled={busy !== null || !mapping || !instance || !mapping.checkField || rows.length === 0 || !canEditTable} size="small" icon="check">
                    {busy === 'check' ? 'Checking…' : `Check ${rows.length || ''} ${rows.length === 1 ? 'number' : 'numbers'}`}
                </PrimaryButton>
                {!mapping && <Reason>Needs a recipients table and phone column — <button type="button" className="ga-link" onClick={() => onOpenSettings('sending')}>Settings → Sending</button>.</Reason>}
                {mapping && !mapping.checkField && <Reason>Needs a column to write the result into — <button type="button" className="ga-link" onClick={() => onOpenSettings('sending')}>Settings → Sending → Columns the extension fills in</button>.</Reason>}
                {mapping && mapping.checkField && rows.length === 0 && <Reason>Select the rows to check in the grid.</Reason>}
            </Card>

            <Card
                title="Chat history"
                description={`Loads the last ${CHAT_HISTORY_COUNT} messages exchanged with the selected contact into the messages table.`}
            >
                {noticeFor('chat')}
                <PrimaryButton onClick={loadChatHistory} disabled={busy !== null || !inboundConfigured || rows.length !== 1 || !rows[0]?.chatId} size="small" icon="history">
                    {busy === 'chat' ? 'Loading…' : 'Load chat history'}
                </PrimaryButton>
                {!inboundConfigured && <Reason>Needs a messages table — <button type="button" className="ga-link" onClick={() => onOpenSettings('receiving')}>Settings → Receiving</button>.</Reason>}
                {inboundConfigured && rows.length !== 1 && <Reason>Select exactly one row in the grid.</Reason>}
            </Card>

            <Card
                title="Import history"
                description="Webhooks only cover what happens after receiving is switched on. This pulls the messenger’s journal for the chosen period into the messages table; messages already there are skipped."
            >
                {noticeFor('history')}
                <div className="ga-row">
                    <Select
                        options={instances.map(i => ({value: String(i.idInstance), label: instanceLabel(i)}))}
                        value={historyInstance || (instances[0] ? String(instances[0].idInstance) : '')}
                        onChange={value => setHistoryInstance(String(value))}
                        disabled={busy !== null || instances.length === 0}
                        size="small"
                        width="14rem"
                    />
                    <Select
                        options={HISTORY_WINDOWS.map(w => ({value: String(w.minutes), label: w.label}))}
                        value={String(historyMinutes)}
                        onChange={value => setHistoryMinutes(Number(value))}
                        disabled={busy !== null}
                        size="small"
                        width="9rem"
                    />
                    <PrimaryButton onClick={importHistory} disabled={busy !== null || !inboundConfigured || instances.length === 0} size="small" icon="download">
                        {busy === 'history' ? 'Importing…' : 'Import'}
                    </PrimaryButton>
                </div>
                {!inboundConfigured && <Reason>Needs a messages table — <button type="button" className="ga-link" onClick={() => onOpenSettings('receiving')}>Settings → Receiving</button>.</Reason>}
            </Card>

            <ContactsImportSection client={client} instances={instances} canEdit={canEditConfig} defaultTableId={config.mapping.tableId} defaultPhoneFieldId={config.mapping.phoneFieldId} />

            {isAdmin ? (
                <AutomationSection client={client} config={config} instances={instances} canEdit={canEditConfig} />
            ) : (
                <Card title="Automations" description="Owners and creators of the base can create keys that let Airtable Automations and other HTTP clients send messages.">
                    <GhostButton disabled size="small">Owners only</GhostButton>
                </Card>
            )}
        </Shell>
    );
}
