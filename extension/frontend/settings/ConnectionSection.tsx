import {Input} from '@airtable/blocks/ui';
import React, {useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {InstanceView} from '../api/types';
import {Badge, Card, DangerButton, Field, GhostButton, instanceStateTone, Notice, PrimaryButton} from '../components/ui';
import {DEFAULT_GREEN_API_URL} from '../defaults';
import {instanceName, MessengerBadge} from '../instances';
import {QrDialog} from './QrDialog';

interface Props {
    canEdit: boolean;
    isAdmin: boolean;
    client: AdapterClient;
    instances: InstanceView[];
    onInstancesChanged: () => Promise<void>;
}

export function ConnectionSection({canEdit, isAdmin, client, instances, onInstancesChanged}: Props) {
    const [idInstance, setIdInstance] = useState('');
    const [token, setToken] = useState('');
    const [apiUrl, setApiUrl] = useState(DEFAULT_GREEN_API_URL);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [qrFor, setQrFor] = useState<InstanceView | null>(null);
    const canManage = canEdit && isAdmin;

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    };

    const addInstance = () => run(async () => {
        await client.addInstance(Number(idInstance), token.trim(), apiUrl.trim(), name.trim() || undefined);
        setToken('');
        setIdInstance('');
        setName('');
        setAdding(false);
        await onInstancesChanged();
    });

    const removeInstance = (id: number) => run(async () => {
        await client.removeInstance(id);
        await onInstancesChanged();
    });

    return (
        <>
            <Card
                title="GREEN-API instances"
                description="The GREEN-API instances this base can send from — WhatsApp, Telegram or MAX; the type is detected when you add one. Credentials are verified and kept by the adapter; nothing is stored in the base."
                action={isAdmin && !adding ? <PrimaryButton onClick={() => setAdding(true)} disabled={!canManage || busy} icon="plus" size="small">Add instance</PrimaryButton> : undefined}
            >
                {error && <Notice tone="error">{error}</Notice>}
                {instances.length === 0 && !adding && <div className="ga-small ga-muted">No instances yet.</div>}
                {instances.length > 0 && (
                    <div className="ga-list">
                        {instances.map(instance => (
                            <div key={instance.idInstance} className="ga-list__item ga-list__item--stack">
                                <div className="ga-list__body">
                                    <div className="ga-list__name">{instanceName(instance)}</div>
                                    <div className="ga-list__meta">{instance.phone ? `+${instance.phone}` : 'phone unknown'}</div>
                                    <div className="ga-row" style={{marginTop: 6}}>
                                        <MessengerBadge messenger={instance.messenger} />
                                        <Badge tone={instanceStateTone(instance.stateInstance)} dot>{instance.stateInstance ?? 'unknown'}</Badge>
                                        {instance.receiveWebhooks && <Badge tone="gray">receiving</Badge>}
                                    </div>
                                </div>
                                <div className="ga-row">
                                    {canManage && instance.stateInstance !== 'authorized' && <GhostButton onClick={() => setQrFor(instance)} size="small" icon="phone">Link phone</GhostButton>}
                                    {canManage && <DangerButton onClick={() => removeInstance(instance.idInstance)} size="small" disabled={busy}>Remove</DangerButton>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {adding && (
                    <div style={{marginTop: 12}}>
                        <Field label="idInstance">
                            <Input value={idInstance} onChange={e => setIdInstance(e.target.value.trim())} disabled={busy} />
                        </Field>
                        <Field label="apiTokenInstance">
                            <Input value={token} onChange={e => setToken(e.target.value)} disabled={busy} />
                        </Field>
                        <Field label="apiUrl" hint="All three are shown in the GREEN-API console for the instance. Use the apiUrl given there.">
                            <Input value={apiUrl} onChange={e => setApiUrl(e.target.value.trim())} disabled={busy} />
                        </Field>
                        <Field label="Name (optional)">
                            <Input value={name} onChange={e => setName(e.target.value)} disabled={busy} placeholder="Sales line" />
                        </Field>
                        <div className="ga-row">
                            <PrimaryButton onClick={addInstance} disabled={busy || !idInstance || !token || !apiUrl}>{busy ? 'Verifying…' : 'Add instance'}</PrimaryButton>
                            <GhostButton onClick={() => setAdding(false)} disabled={busy}>Cancel</GhostButton>
                        </div>
                    </div>
                )}
                {!isAdmin && <div className="ga-small ga-muted" style={{marginTop: 8}}>Only base owners and creators can add or remove instances.</div>}
            </Card>
            {qrFor && <QrDialog client={client} instance={qrFor} onAuthorized={onInstancesChanged} onClose={() => setQrFor(null)} />}
        </>
    );
}
