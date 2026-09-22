import {Input} from '@airtable/blocks/ui';
import React, {useCallback, useEffect, useState} from 'react';
import {AdapterClient} from '../api/adapterClient';
import {BaseView, InstanceView} from '../api/types';
import {Brand, Card, Field, GhostButton, Notice, PrimaryButton, Shell, Tabs} from '../components/ui';
import {GlobalConfig, writeServer} from '../config/globalConfig';
import {GlobalConfigV1} from '../config/types';
import {ConnectionSection} from './ConnectionSection';
import {IdentitySection} from './IdentitySection';
import {InboundSection} from './InboundSection';
import {MappingSection} from './MappingSection';

interface Props {
    config: GlobalConfigV1;
    globalConfig: GlobalConfig;
    canEdit: boolean;
    reason: string;
    client: AdapterClient;
    view: BaseView;
    onViewChanged: () => Promise<void>;
    onForget: () => void;
    onDone: () => void;
    initialTab: SettingsTab;
}

export type SettingsTab = 'sending' | 'instances' | 'people' | 'receiving' | 'advanced';

export function SettingsScreen({config, globalConfig, canEdit, reason, client, view, onViewChanged, onForget, onDone, initialTab}: Props) {
    const isAdmin = view.me.isAdmin;
    const [instances, setInstances] = useState<InstanceView[]>([]);
    const [tab, setTab] = useState<SettingsTab>(initialTab);
    const [url, setUrl] = useState(config.server.url);

    const refreshInstances = useCallback(async () => {
        try {
            setInstances(await client.listInstances());
        } catch {
            setInstances([]);
        }
    }, [client]);

    useEffect(() => {
        void refreshInstances();
    }, [refreshInstances]);

    const tabs: Array<{id: SettingsTab; label: string}> = [
        {id: 'sending', label: 'Sending'},
        {id: 'instances', label: 'Instances'},
        {id: 'people', label: 'People'},
        ...(isAdmin ? [{id: 'receiving' as SettingsTab, label: 'Receiving'}, {id: 'advanced' as SettingsTab, label: 'Advanced'}] : []),
    ];

    const header = (
        <>
            <Brand subtitle={<span className="ga-muted ga-small" style={{marginLeft: 6}}>· Settings</span>} />
            <span className="ga-header__spacer" />
            <PrimaryButton onClick={onDone} icon="check" size="small">Done</PrimaryButton>
        </>
    );

    return (
        <Shell header={header}>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
            {!canEdit && <Notice tone="info">{reason || 'You can view these settings but not change them.'}</Notice>}
            {tab === 'sending' && <MappingSection config={config} globalConfig={globalConfig} canEdit={canEdit} />}
            {tab === 'instances' && (
                <ConnectionSection canEdit={canEdit} isAdmin={isAdmin} allowedIds={isAdmin ? null : view.me.idInstances} client={client} instances={instances} onInstancesChanged={refreshInstances} />
            )}
            {tab === 'people' && <IdentitySection client={client} me={view.me} onViewChanged={onViewChanged} instances={instances} canEdit={canEdit} onForget={onForget} />}
            {tab === 'receiving' && isAdmin && (
                <InboundSection client={client} canEdit={canEdit} instances={instances} onInstancesChanged={refreshInstances} contactsTableId={config.mapping.tableId} />
            )}
            {tab === 'advanced' && isAdmin && (
                <Card title="Adapter" description="Only for self-hosted adapters. Everyone in this base uses the URL saved here.">
                    <Field label="Adapter URL">
                        <div className="ga-row">
                            <Input value={url} onChange={e => setUrl(e.target.value)} disabled={!canEdit} />
                            <GhostButton
                                onClick={() => void writeServer(globalConfig, {url: url.trim().replace(/\/+$/, '')})}
                                disabled={!canEdit || url.trim().replace(/\/+$/, '') === config.server.url}
                            >
                                Save
                            </GhostButton>
                        </div>
                    </Field>
                </Card>
            )}
        </Shell>
    );
}
