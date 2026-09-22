import {cursor} from '@airtable/blocks';
import {Record} from '@airtable/blocks/models';
import {ConfirmationDialog, expandRecord, useLoadable, useRecords, useWatchable} from '@airtable/blocks/ui';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {InstanceSummaryView, JobItemView, JobView} from '../api/types';
import {Avatar, Badge, Card, DangerButton, Notice, PrimaryButton, Progress, Segment, Shell, Stat} from '../components/ui';
import {BUTTONS_MESSENGERS, FILE_ITEMS_WARNING_THRESHOLD, MESSAGE_TYPE_LABELS, MESSENGER_LABELS, PREVIEW_LIMIT} from '../defaults';
import {instanceLabel} from '../instances';
import {buildPreview, fieldsToLoad, PreviewRow, ResolvedMapping, toJobItems} from './compose';
import {isJobActive, useJob} from './useJob';
import {ensureStatusChoices, hasWriteBack, jobWriteBack, writeBackItems} from './writeBack';

interface Props {
    mapping: ResolvedMapping;
    viewId: string | null;
    instance: InstanceSummaryView;
    client: AdapterClient;
    header: React.ReactNode;
    nav: React.ReactNode;
}

type Source = 'selection' | 'all';

const SOURCE_OPTIONS: Array<{id: Source; label: string}> = [
    {id: 'selection', label: 'Selected rows'},
    {id: 'all', label: 'Whole view'},
];

function PreviewList({rows}: {rows: PreviewRow[]}) {
    const shown = rows.slice(0, PREVIEW_LIMIT);
    return (
        <div className="ga-list">
            {shown.map(row => {
                const name = row.record.name || row.record.id;
                return (
                    <div key={row.record.id} className={`ga-list__item ${row.problem ? 'ga-list__item--problem' : ''}`}>
                        <Avatar name={name} problem={Boolean(row.problem)} />
                        <div className="ga-list__body">
                            <div className="ga-row ga-row--between">
                                <button type="button" className="ga-link ga-list__name" style={{textDecoration: 'none'}} onClick={() => expandRecord(row.record)}>{name}</button>
                                {row.problem
                                    ? <Badge tone="red">{row.problem}{row.phone && row.problem === 'invalid phone' ? `: ${row.phone}` : ''}</Badge>
                                    : <span className="ga-list__meta">{row.chatId}</span>}
                            </div>
                            {row.summary && <div className="ga-list__text">{row.summary}</div>}
                            {row.unknownPlaceholders.length > 0 && (
                                <div className="ga-list__meta" style={{color: 'var(--ga-amber)'}}>Unknown placeholders: {row.unknownPlaceholders.map(p => `{${p}}`).join(', ')}</div>
                            )}
                        </div>
                    </div>
                );
            })}
            {rows.length > PREVIEW_LIMIT && <div className="ga-list__item ga-muted ga-small">…and {rows.length - PREVIEW_LIMIT} more</div>}
        </div>
    );
}

function JobPanel({job, error, busy, onCancel, onReset, queue, onClearQueue}: {
    job: JobView;
    error: string | null;
    busy: boolean;
    onCancel: () => void;
    onReset: () => void;
    queue: number | null;
    onClearQueue: (() => void) | null;
}) {
    const done = job.sent + job.failed;
    const active = isJobActive(job);
    const remaining = job.total - done;
    const failed = job.items.filter(i => i.status !== 'sent' && i.status !== 'queued');
    return (
        <Card
            title={active ? 'Handing off to GREEN-API…' : job.status === 'cancelled' ? 'Cancelled' : 'Handed off to GREEN-API'}
            action={active ? <Badge tone="amber" dot>in progress</Badge> : job.failed > 0 ? <Badge tone="red">{job.failed} failed</Badge> : <Badge tone="green" dot>done</Badge>}
        >
            <Progress value={job.total === 0 ? 1 : done / job.total} />
            <div className="ga-stats">
                <Stat value={job.sent} label="sent" tone="green" />
                <Stat value={job.failed} label="failed" tone={job.failed > 0 ? 'red' : undefined} />
                <Stat value={remaining} label="remaining" />
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {!active && queue !== null && queue > 0 && (
                <Notice tone="info">
                    {queue} message{queue === 1 ? '' : 's'} still waiting in GREEN-API’s queue for this instance (sent one by one at the instance’s delay).
                    {onClearQueue && <> <button type="button" className="ga-link ga-small" onClick={onClearQueue}>Clear the queue</button></>}
                </Notice>
            )}
            {failed.length > 0 && !active && (
                <div className="ga-list" style={{maxHeight: '30vh', overflowY: 'auto', marginBottom: 10}}>
                    {failed.map(i => (
                        <div key={i.recordId ?? i.chatId} className="ga-list__item ga-list__item--problem">
                            <div className="ga-list__body">
                                <div className="ga-list__meta">{i.chatId || i.recordId}</div>
                                <div className="ga-small">{i.error ?? i.status}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="ga-row">
                {active
                    ? <DangerButton onClick={onCancel} disabled={busy}>Cancel remaining</DangerButton>
                    : <PrimaryButton onClick={onReset}>New send</PrimaryButton>}
            </div>
        </Card>
    );
}

export function SendScreen({mapping, viewId, instance, client, header, nav}: Props) {
    const idInstance = instance.idInstance;
    useLoadable(cursor);
    useWatchable(cursor, ['selectedRecordIds', 'activeTableId']);
    const view = viewId ? mapping.table.getViewByIdIfExists(viewId) : null;
    const records = useRecords(view ?? mapping.table, {fields: fieldsToLoad(mapping)});
    const [source, setSource] = useState<Source>('selection');
    const [confirming, setConfirming] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [statusWarning, setStatusWarning] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [queue, setQueue] = useState<number | null>(null);
    const [clearingQueue, setClearingQueue] = useState(false);

    const selectionMatchesTable = cursor.activeTableId === mapping.table.id;
    const selectedIds = cursor.selectedRecordIds;
    const selected: Record[] = selectionMatchesTable ? records.filter(r => selectedIds.includes(r.id)) : [];
    const candidates = source === 'selection' ? selected : records;
    const rows = useMemo(() => buildPreview(candidates, mapping, instance.messenger), [candidates, mapping, instance.messenger]);
    const typeUnsupported = mapping.message.type === 'buttons' && !BUTTONS_MESSENGERS.includes(instance.messenger);
    const sendable = rows.filter(row => row.payload !== null && row.chatId !== null);
    const fileCount = mapping.message.type === 'file' ? sendable.length : 0;
    const canUpdate = mapping.table.hasPermissionToUpdateRecords();

    const settle = useCallback(
        async (items: JobItemView[]) => {
            if (hasWriteBack(mapping)) {
                await writeBackItems(mapping.table, mapping, items);
            }
        },
        [mapping],
    );
    const job = useJob(client, settle);
    const {track} = job;

    const jobActive = job.job ? isJobActive(job.job) : false;
    const jobId = job.job?.id ?? null;
    useEffect(() => {
        if (!jobId || jobActive) {
            return;
        }
        let cancelled = false;
        client.queue(idInstance).then(next => {
            if (!cancelled) {
                setQueue(next.count);
            }
        }).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [client, idInstance, jobId, jobActive]);

    useEffect(() => {
        let cancelled = false;
        client.listJobs(1).then(jobs => {
            if (!cancelled && jobs[0] && (jobs[0].status === 'queued' || jobs[0].status === 'running')) {
                track(jobs[0].id);
            }
        }).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [client, track]);

    const submit = async () => {
        setConfirming(false);
        setSubmitting(true);
        setSubmitError(null);
        try {
            const missing = await ensureStatusChoices(mapping.statusField);
            setStatusWarning(missing.length > 0
                ? `Status field “${mapping.statusField?.name}” lacks the options ${missing.join(', ')} and you cannot add them; those statuses will not be written.`
                : null);
            const {jobId} = await client.createJob({
                idInstance,
                writeBack: hasWriteBack(mapping) ? jobWriteBack(mapping) : undefined,
                items: toJobItems(sendable),
            });
            track(jobId);
        } catch (e) {
            setSubmitError(describeError(e));
        } finally {
            setSubmitting(false);
        }
    };

    const typeLabel = MESSAGE_TYPE_LABELS[mapping.message.type] ?? mapping.message.type;

    if (job.job) {
        return (
            <Shell header={header}>
                {nav}
                <JobPanel
                    job={job.job}
                    error={job.error}
                    busy={job.busy}
                    onCancel={() => void job.cancel()}
                    onReset={() => {
                        setQueue(null);
                        job.reset();
                    }}
                    queue={queue}
                    onClearQueue={() => setClearingQueue(true)}
                />
                {clearingQueue && (
                    <ConfirmationDialog
                        title="Clear GREEN-API's queue?"
                        body={`Every message still waiting on ${instanceLabel(instance)} will be dropped — including ones queued by other people or automations. Messages already delivered are not affected.`}
                        confirmButtonText="Clear queue"
                        isConfirmActionDangerous
                        onConfirm={() => {
                            setClearingQueue(false);
                            client.clearQueue(idInstance).then(next => setQueue(next.count)).catch(() => undefined);
                        }}
                        onCancel={() => setClearingQueue(false)}
                    />
                )}
            </Shell>
        );
    }

    const skipped = rows.length - sendable.length;
    const footer = (
        <>
            <div className="ga-small ga-muted" style={{flex: 1}}>
                {sendable.length} ready{skipped > 0 ? ` · ${skipped} skipped` : ''} · {typeLabel}
            </div>
            <PrimaryButton onClick={() => setConfirming(true)} disabled={!canUpdate || submitting || sendable.length === 0} icon="chat">
                {submitting ? 'Submitting…' : `Send ${sendable.length}`}
            </PrimaryButton>
        </>
    );

    return (
        <Shell header={header} footer={footer}>
            {nav}
            {!canUpdate && <Notice tone="info">Sending needs editor access to “{mapping.table.name}”.</Notice>}
            {typeUnsupported && <Notice tone="warning">Buttons can only be sent through WhatsApp. Pick a WhatsApp instance, or change the message type in settings.</Notice>}
            <Card
                title="Recipients"
                action={<Segment options={SOURCE_OPTIONS} value={source} onChange={setSource} />}
                description={source === 'selection'
                    ? (selectionMatchesTable ? `${selected.length} selected in ${mapping.table.name}. Click rows in the grid to change the selection.` : `Select rows in “${mapping.table.name}” to use this option.`)
                    : `${records.length} records in ${view ? `view “${view.name}”` : `table “${mapping.table.name}”`}.`}
            >
                {rows.length > 0 ? <PreviewList rows={rows} /> : <div className="ga-small ga-muted">Nothing to preview yet.</div>}
            </Card>
            {skipped > 0 && <Notice tone="warning">{skipped} record{skipped === 1 ? '' : 's'} will be skipped — see the highlighted rows.</Notice>}
            {fileCount > FILE_ITEMS_WARNING_THRESHOLD && (
                <Notice tone="warning">Attachment links expire after ~2 hours; a queue of {fileCount} files may not finish in time.</Notice>
            )}
            {submitError && <Notice tone="error">{submitError}</Notice>}
            {statusWarning && <Notice tone="warning">{statusWarning}</Notice>}
            {confirming && (
                <ConfirmationDialog
                    title={`Send ${sendable.length} ${MESSENGER_LABELS[instance.messenger]} message${sendable.length === 1 ? '' : 's'}?`}
                    body={`The recipient and message content of ${sendable.length} record${sendable.length === 1 ? '' : 's'} will be sent to GREEN-API for delivery via ${instanceLabel(instance)}. This cannot be undone once delivered.`}
                    confirmButtonText="Send"
                    isConfirmActionDangerous={false}
                    onConfirm={() => void submit()}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </Shell>
    );
}
