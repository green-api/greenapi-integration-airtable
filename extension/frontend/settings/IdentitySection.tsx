import React, {useCallback, useEffect, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {InstanceView, UserView} from '../api/types';
import {Avatar, Badge, Card, Chip, GhostButton, Notice} from '../components/ui';
import {instanceName} from '../instances';
import {MESSENGER_LABELS} from '../defaults';

interface Props {
    client: AdapterClient;
    me: UserView;
    onViewChanged: () => Promise<void>;
    instances: InstanceView[];
    canEdit: boolean;
    onForget: () => void;
}

export function userLabel(user: UserView): string {
    return user.name ?? user.email ?? user.airtableUserId;
}

function allowedSummary(user: UserView, instances: InstanceView[]): string {
    if (user.isAdmin) {
        return 'every instance of this base';
    }
    if (user.idInstances.length === 0) {
        return 'nothing yet — a base owner has to allow an instance';
    }
    return user.idInstances
        .map(id => instances.find(i => i.idInstance === id)?.name ?? String(id))
        .join(', ');
}

export function IdentitySection({client, me, onViewChanged, instances, canEdit, onForget}: Props) {
    const [users, setUsers] = useState<UserView[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadUsers = useCallback(async () => {
        if (!me.isAdmin) {
            setUsers([]);
            return;
        }
        try {
            setUsers(await client.listUsers());
        } catch {
            setUsers([]);
        }
    }, [client, me.isAdmin]);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            await loadUsers();
            await onViewChanged();
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    };

    const toggleInstance = (user: UserView, idInstance: number) => run(() => {
        const allowed = !user.idInstances.includes(idInstance);
        return client.setUserInstances(user.id, allowed ? [...user.idInstances, idInstance] : user.idInstances.filter(id => id !== idInstance));
    });
    const revoke = (user: UserView) => run(() => client.revokeUser(user.id));

    return (
        <>
            <Card title="You" action={<GhostButton onClick={onForget} size="small" disabled={busy}>Forget me on this browser</GhostButton>}>
                <div className="ga-row">
                    <Avatar name={userLabel(me)} />
                    <div className="ga-list__body">
                        <div className="ga-row">
                            <span className="ga-list__name">{userLabel(me)}</span>
                            <Badge tone={me.isAdmin ? 'green' : 'gray'}>{me.isAdmin ? 'owner / creator' : 'editor'}</Badge>
                        </div>
                        <div className="ga-list__meta">Can send with: {allowedSummary(me, instances)}</div>
                    </div>
                </div>
            </Card>

            {me.isAdmin && (
                <Card
                    title="Who may send with which instance"
                    description="Everyone confirms their identity once from their own browser and then appears here. Owners and creators can use every instance; for editors, tick the ones they may use."
                >
                    {error && <Notice tone="error">{error}</Notice>}
                    {users.length === 0 && <div className="ga-small ga-muted">Nobody else yet.</div>}
                    {users.map(user => (
                        <div key={user.id} className="ga-person">
                            <div className="ga-row ga-row--between">
                                <div className="ga-row">
                                    <Avatar name={userLabel(user)} />
                                    <div>
                                        <div className="ga-row">
                                            <span className="ga-list__name">{userLabel(user)}</span>
                                            <Badge tone={user.isAdmin ? 'green' : 'gray'}>{user.isAdmin ? 'owner / creator' : 'editor'}</Badge>
                                            {!user.hasKey && <Badge tone="red">revoked</Badge>}
                                        </div>
                                        {user.name && user.email && <div className="ga-list__meta">{user.email}</div>}
                                    </div>
                                </div>
                                {user.hasKey && user.id !== me.id && <GhostButton onClick={() => revoke(user)} size="small" disabled={!canEdit || busy}>Revoke</GhostButton>}
                            </div>
                            {user.isAdmin ? (
                                <div className="ga-small ga-muted" style={{marginTop: 6}}>Every instance of this base.</div>
                            ) : (
                                <div className="ga-chips">
                                    {instances.map(instance => (
                                        <Chip
                                            key={instance.idInstance}
                                            on={user.idInstances.includes(instance.idInstance)}
                                            onClick={() => toggleInstance(user, instance.idInstance)}
                                            disabled={!canEdit || busy}
                                        >
                                            {instanceName(instance)} · {MESSENGER_LABELS[instance.messenger]}
                                        </Chip>
                                    ))}
                                </div>
                            )}
                            {user.idInstances.length === 0 && !user.isAdmin && (
                                <div className="ga-small" style={{color: 'var(--ga-amber)', marginTop: 6}}>Cannot send until an instance is allowed.</div>
                            )}
                        </div>
                    ))}
                </Card>
            )}
        </>
    );
}
