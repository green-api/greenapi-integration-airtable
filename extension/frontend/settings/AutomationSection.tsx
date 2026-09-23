import {FieldType} from '@airtable/blocks/models';
import {Input, Select, useBase} from '@airtable/blocks/ui';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {AutomationKeyView, InstanceSummaryView} from '../api/types';
import {MessageType} from '../config/types';
import {Badge, Card, DangerButton, Field, GhostButton, Notice, PrimaryButton, Segment} from '../components/ui';
import {GlobalConfigV1} from '../config/types';
import {API_PREFIX, MESSAGE_TYPE_LABELS} from '../defaults';
import {instanceLabel} from '../instances';

interface Props {
    client: AdapterClient;
    config: GlobalConfigV1;
    instances: InstanceSummaryView[];
    canEdit: boolean;
}

const ANY_INSTANCE = '';

async function copyText(text: string, fallbackTarget: HTMLInputElement | HTMLTextAreaElement | null): Promise<boolean> {
    if (await navigator.clipboard.writeText(text).then(() => true, () => false)) {
        return true;
    }
    if (fallbackTarget) {
        fallbackTarget.focus();
        fallbackTarget.select();
    }
    return false;
}

interface SnippetShape {
    inputs: string[];
    payload: string;
    note: string;
}

const SNIPPET_SHAPES: Record<MessageType, SnippetShape> = {
    text: {
        inputs: ['message'],
        payload: "{type: 'text', text: message}",
        note: 'message — the text to send.',
    },
    file: {
        inputs: ['fileUrl', 'fileName', 'caption'],
        payload: "{type: 'file', url: fileUrl, fileName, caption}",
        note: 'fileUrl — a public link (for an attachment field, map the field and pick “URL” of the first attachment); fileName — with extension, decides how it is shown; caption — optional.',
    },
    location: {
        inputs: ['latitude', 'longitude', 'placeName', 'address'],
        payload: "{type: 'location', latitude: Number(latitude), longitude: Number(longitude), name: placeName, address}",
        note: 'latitude / longitude — numbers; placeName and address — optional.',
    },
    contact: {
        inputs: ['contactPhone', 'firstName', 'lastName', 'company'],
        payload: "{type: 'contact', phone: contactPhone, firstName, lastName, company}",
        note: 'contactPhone — the number on the card being sent (not the recipient); the rest optional.',
    },
    poll: {
        inputs: ['question', 'options'],
        payload: "{type: 'poll', question, options: String(options).split(',').map(o => o.trim()).filter(Boolean), multipleAnswers: false}",
        note: 'options — 2 to 12 answers, comma-separated in one input; set multipleAnswers to true to allow several.',
    },
    buttons: {
        inputs: ['message'],
        payload: "{type: 'buttons', body: message, buttons: [{type: 'reply', text: 'Yes'}, {type: 'reply', text: 'No'}]}",
        note: 'WhatsApp only. Up to 3 buttons: either all reply, or url / call / copy with a value, e.g. {type: \'url\', text: \'Open\', value: \'https://…\'}.',
    },
};

function scriptSnippet(config: GlobalConfigV1, instances: InstanceSummaryView[], statusFieldType: 'singleSelect' | 'text' | null, type: MessageType): string {
    const idInstance = instances[0]?.idInstance ?? 1101000001;
    const {tableId, writeBack} = config.mapping;
    const shape = SNIPPET_SHAPES[type];
    const inputs = ['phone', ...shape.inputs, 'recordId'];
    const writeBackLine = tableId && writeBack.statusFieldId && statusFieldType
        ? `\n        writeBack: {tableId: '${tableId}', statusFieldId: '${writeBack.statusFieldId}', statusFieldType: '${statusFieldType}'},`
        : '';
    return `// Automation → Run script. Input variables (from the trigger record): ${inputs.join(', ')}.
// ${shape.note}
const {${inputs.join(', ')}} = input.config();
const response = await fetch('${config.server.url}${API_PREFIX}/send', {
    method: 'POST',
    headers: {'Authorization': 'Bearer ak_PASTE_YOUR_KEY', 'Content-Type': 'application/json'},
    body: JSON.stringify({
        idInstance: ${idInstance},
        phone,
        recordId,
        payload: ${shape.payload},${writeBackLine}
    }),
});
const result = await response.json();
if (!response.ok || result.status === 'failed') {
    throw new Error(result.error ?? result.message ?? response.statusText);
}
output.set('idMessage', result.idMessage);`;
}

export function AutomationSection({client, config, instances, canEdit}: Props) {
    const base = useBase();
    const [keys, setKeys] = useState<AutomationKeyView[]>([]);
    const [name, setName] = useState('');
    const [idInstance, setIdInstance] = useState(ANY_INSTANCE);
    const [creating, setCreating] = useState(false);
    const [issued, setIssued] = useState<{name: string; key: string} | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<'key' | 'script' | null>(null);
    const [copyHint, setCopyHint] = useState<string | null>(null);
    const [snippetType, setSnippetType] = useState<MessageType>('text');
    const keyInput = useRef<HTMLInputElement>(null);
    const scriptArea = useRef<HTMLTextAreaElement>(null);

    const load = useCallback(async () => {
        try {
            setKeys(await client.listAutomationKeys());
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
        try {
            await action();
            await load();
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    };

    const create = () => run(async () => {
        const result = await client.createAutomationKey(name.trim(), idInstance ? Number(idInstance) : null);
        setIssued({name: result.automationKey.name, key: result.key});
        setName('');
        setIdInstance(ANY_INSTANCE);
        setCreating(false);
    });

    const revoke = (key: AutomationKeyView) => run(async () => {
        await client.revokeAutomationKey(key.id);
        if (issued?.name === key.name) {
            setIssued(null);
        }
    });

    const copy = async (what: 'key' | 'script', text: string) => {
        const ok = await copyText(text, what === 'key' ? keyInput.current : scriptArea.current);
        setCopyHint(ok ? null : 'Copying is blocked here — the text is selected, press Ctrl+C / ⌘C.');
        setCopied(ok ? what : null);
        setTimeout(() => setCopied(null), 1500);
    };

    const table = config.mapping.tableId ? base.getTableByIdIfExists(config.mapping.tableId) : null;
    const statusField = table && config.mapping.writeBack.statusFieldId ? table.getFieldByIdIfExists(config.mapping.writeBack.statusFieldId) : null;
    const statusFieldType = statusField ? (statusField.type === FieldType.SINGLE_SELECT ? 'singleSelect' : 'text') : null;
    const snippet = scriptSnippet(config, instances, statusFieldType, snippetType);
    const typeOptions = (Object.keys(MESSAGE_TYPE_LABELS) as MessageType[]).map(type => ({id: type, label: MESSAGE_TYPE_LABELS[type]}));
    const instanceOptions = [{value: ANY_INSTANCE, label: 'Any instance of this base'}, ...instances.map(i => ({value: String(i.idInstance), label: instanceLabel(i)}))];

    return (
        <>
            <Card
                title="Automation keys"
                description="Let Airtable Automations, Interface buttons or any HTTP client send messages without opening this panel. A key can only send; it cannot change settings. Revoke it here at any time."
                action={!creating ? <PrimaryButton onClick={() => setCreating(true)} disabled={!canEdit || busy} icon="plus" size="small">Create key</PrimaryButton> : undefined}
            >
                {error && <Notice tone="error">{error}</Notice>}
                {issued && (
                    <Notice tone="success">
                        <div>Key “{issued.name}” created. Copy it now — it is shown only once.</div>
                        <div className="ga-row" style={{marginTop: 6}}>
                            <input ref={keyInput} className="ga-code ga-code--input" value={issued.key} readOnly onFocus={e => e.target.select()} />
                            <GhostButton onClick={() => void copy('key', issued.key)} size="small" icon="duplicate">{copied === 'key' ? 'Copied' : 'Copy'}</GhostButton>
                        </div>
                        {copyHint && <div className="ga-small" style={{marginTop: 4}}>{copyHint}</div>}
                    </Notice>
                )}
                {creating && (
                    <div style={{marginBottom: 12}}>
                        <Field label="Name" hint="Where it will be used, e.g. “Order confirmation automation”.">
                            <Input value={name} onChange={e => setName(e.target.value)} disabled={busy} />
                        </Field>
                        <Field label="Instance">
                            <Select options={instanceOptions} value={idInstance} onChange={value => setIdInstance(String(value))} disabled={busy} />
                        </Field>
                        <div className="ga-row">
                            <PrimaryButton onClick={create} disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</PrimaryButton>
                            <GhostButton onClick={() => setCreating(false)} disabled={busy}>Cancel</GhostButton>
                        </div>
                    </div>
                )}
                {keys.length === 0 && !creating && <div className="ga-small ga-muted">No keys yet.</div>}
                {keys.length > 0 && (
                    <div className="ga-list">
                        {keys.map(key => {
                            const instance = instances.find(i => i.idInstance === key.idInstance);
                            return (
                                <div key={key.id} className="ga-list__item ga-list__item--stack">
                                    <div className="ga-list__body">
                                        <div className="ga-list__name">{key.name}</div>
                                        <div className="ga-list__meta">
                                            {key.idInstance === null ? 'any instance' : instance ? instanceLabel(instance) : `instance ${key.idInstance}`}
                                            {' · created '}{new Date(key.createdAt).toLocaleDateString()}
                                            {key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}` : ' · never used'}
                                        </div>
                                    </div>
                                    {key.idInstance === null && <Badge tone="gray">any</Badge>}
                                    <DangerButton onClick={() => revoke(key)} size="small" disabled={!canEdit || busy}>Revoke</DangerButton>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            <Card
                title="Script for an Automation"
                description="Automations → Run script. Pick the message type, add the input variables the first line lists (mapped to fields of the trigger record), paste the script and replace the key. The table and status column come from the Sending tab."
                action={<GhostButton onClick={() => void copy('script', snippet)} size="small" icon="duplicate">{copied === 'script' ? 'Copied' : 'Copy'}</GhostButton>}
            >
                <div style={{marginBottom: 8}}>
                    <Segment options={typeOptions} value={snippetType} onChange={setSnippetType} />
                </div>
                <textarea ref={scriptArea} className="ga-code-block" value={snippet} readOnly rows={18} onFocus={e => e.target.select()} spellCheck={false} />
                {copyHint && copied === null && <div className="ga-small ga-muted" style={{marginTop: 4}}>{copyHint}</div>}
            </Card>
        </>
    );
}
