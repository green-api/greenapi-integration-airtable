import {Input, Link, Select, useBase, useSettingsButton} from '@airtable/blocks/ui';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AdapterClient, describeError} from './api/adapterClient';
import {BaseView} from './api/types';
import {Badge, Brand, Card, EmptyState, Field, GhostButton, Notice, PrimaryButton, Shell, Tabs} from './components/ui';
import {useConfig, writeServer} from './config/globalConfig';
import {usePersonalKey} from './config/personalKey';
import {resolveMapping} from './send/compose';
import {SendScreen} from './send/SendScreen';
import {SettingsScreen, SettingsTab} from './settings/SettingsScreen';
import {ToolsScreen} from './tools/ToolsScreen';
import {SetupChecklist, setupComplete} from './main/SetupChecklist';
import {messageReady} from './send/compose';
import {readChosenInstance, writeChosenInstance} from './config/chosenInstance';
import {instanceShortLabel} from './instances';
import {MESSENGER_TONES} from './defaults';
import './style.css';

const CLAIM_POLL_MS = 2000;
const CLAIM_POLL_LIMIT = 90;

function SettingsButton({onClick}: {onClick: () => void}) {
    return <GhostButton onClick={onClick} icon="cog" size="small" aria-label="Settings">Settings</GhostButton>;
}

function IdentityGate({baseId, adapterUrl, canEditConfig, onAdapterUrl, onPersonalKey}: {
    baseId: string;
    adapterUrl: string;
    canEditConfig: boolean;
    onAdapterUrl: (url: string) => Promise<void>;
    onPersonalKey: (key: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authUrl, setAuthUrl] = useState<string | null>(null);
    const [showUrl, setShowUrl] = useState(false);
    const [url, setUrl] = useState(adapterUrl);

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            const client = new AdapterClient(adapterUrl, null);
            const {url: authorize, state} = await client.identitySession(baseId);
            const popup = window.open(authorize, 'greenapi-airtable-identity', 'width=600,height=720');
            setAuthUrl(popup ? null : authorize);
            for (let i = 0; i < CLAIM_POLL_LIMIT; i++) {
                await new Promise(resolve => setTimeout(resolve, CLAIM_POLL_MS));
                const claim = await client.oauthClaim(state);
                if ('personalKey' in claim) {
                    onPersonalKey(claim.personalKey);
                    return;
                }
                if (popup?.closed && i > 2) {
                    break;
                }
            }
            throw new Error('Authorization was not completed. Try again.');
        } catch (e) {
            setError(describeError(e));
        } finally {
            setAuthUrl(null);
            setBusy(false);
        }
    };

    return (
        <Shell header={<Brand />}>
            <EmptyState
                title="Send WhatsApp, Telegram and MAX messages from this base"
                body={
                    <>
                        Confirm with your Airtable account that you’re a collaborator on this base. Once per browser.
                    </>
                }
                action={<PrimaryButton onClick={confirm} disabled={busy} size="large">{busy ? 'Waiting for Airtable…' : 'Confirm with Airtable'}</PrimaryButton>}
            />
            {error && <Notice tone="error">{error}</Notice>}
            {authUrl && (
                <Notice tone="warning">
                    The browser blocked the pop-up. <Link href={authUrl} target="_blank">Open the Airtable authorization page</Link>, then come back here.
                </Notice>
            )}
            <div className="ga-small ga-muted" style={{textAlign: 'center', marginTop: 8}}>
                {showUrl ? (
                    <Card>
                        <Field label="Adapter URL (self-hosted adapters only)">
                            <div className="ga-row">
                                <Input value={url} onChange={e => setUrl(e.target.value)} disabled={!canEditConfig || busy} />
                                <GhostButton onClick={() => void onAdapterUrl(url.trim().replace(/\/+$/, ''))} disabled={!canEditConfig || busy}>Save</GhostButton>
                            </div>
                        </Field>
                    </Card>
                ) : (
                    <>
                        Adapter: {adapterUrl} · <button type="button" className="ga-link" onClick={() => setShowUrl(true)}>change</button>
                    </>
                )}
            </div>
        </Shell>
    );
}

export function App() {
    const base = useBase();
    const {config, globalConfig, canEdit, reason} = useConfig();
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('sending');
    const [mainTab, setMainTab] = useState<'send' | 'tools'>('send');
    const [personalKey, setPersonalKey] = usePersonalKey(base.id, config.server.url);
    const [view, setView] = useState<BaseView | null>(null);
    const [viewError, setViewError] = useState<string | null>(null);
    const [chosenInstance, setChosenInstance] = useState<number | null>(() => readChosenInstance(base.id));
    useSettingsButton(() => setShowSettings(value => !value));

    const client = useMemo(
        () => (personalKey ? new AdapterClient(config.server.url, personalKey) : null),
        [config.server.url, personalKey],
    );

    const refreshView = useCallback(async () => {
        if (!client) {
            setView(null);
            return;
        }
        try {
            setView(await client.me());
            setViewError(null);
        } catch (e) {
            if ((e as {code?: string}).code === 'KEY_INVALID') {
                setPersonalKey(null);
                setView(null);
            } else {
                setViewError(describeError(e));
            }
        }
    }, [client, setPersonalKey]);

    useEffect(() => {
        void refreshView();
    }, [refreshView, showSettings]);

    const openSettings = (tab: SettingsTab = 'sending') => {
        setSettingsTab(tab);
        setShowSettings(true);
    };
    const forget = () => {
        setPersonalKey(null);
        setShowSettings(false);
    };

    if (!client) {
        return (
            <IdentityGate
                baseId={base.id}
                adapterUrl={config.server.url}
                canEditConfig={canEdit}
                onAdapterUrl={url => writeServer(globalConfig, {url})}
                onPersonalKey={setPersonalKey}
            />
        );
    }
    if (viewError) {
        return (
            <Shell header={<Brand />}>
                <Notice tone="error">{viewError}</Notice>
                <div className="ga-row">
                    <PrimaryButton onClick={() => void refreshView()}>Retry</PrimaryButton>
                    <GhostButton onClick={forget}>Forget me on this browser</GhostButton>
                </div>
            </Shell>
        );
    }
    if (!view) {
        return <Shell header={<Brand />}><div className="ga-muted ga-small">Loading…</div></Shell>;
    }
    if (showSettings) {
        return (
            <SettingsScreen
                config={config}
                globalConfig={globalConfig}
                canEdit={canEdit}
                reason={reason}
                client={client}
                view={view}
                onViewChanged={refreshView}
                onForget={forget}
                onDone={() => setShowSettings(false)}
                initialTab={settingsTab}
            />
        );
    }

    const usable = view.me.isAdmin ? view.instances : view.instances.filter(i => view.me.idInstances.includes(i.idInstance));
    const instance = usable.find(i => i.idInstance === chosenInstance) ?? usable[0] ?? null;
    const chooseInstance = (idInstance: number) => {
        writeChosenInstance(base.id, idInstance);
        setChosenInstance(idInstance);
    };
    const table = config.mapping.tableId ? base.getTableByIdIfExists(config.mapping.tableId) : null;
    const mapping = resolveMapping(table, config.mapping);
    const inboundConfigured = view.airtable.connected && view.inbound !== null;
    const setup = {
        instance: view.instances.length > 0,
        recipients: Boolean(table && config.mapping.phoneFieldId && table.getFieldByIdIfExists(config.mapping.phoneFieldId)),
        message: Boolean(table && messageReady(config.mapping.message, table)),
        receiving: inboundConfigured,
        isAdmin: view.me.isAdmin,
    };
    const header = (
        <>
            <Brand />
            <span className="ga-header__spacer" />
            {usable.length > 1 ? (
                <Select
                    options={usable.map(i => ({value: String(i.idInstance), label: instanceShortLabel(i)}))}
                    value={instance ? String(instance.idInstance) : ''}
                    onChange={value => chooseInstance(Number(value))}
                    size="small"
                    width="11rem"
                />
            ) : instance ? (
                <Badge tone={MESSENGER_TONES[instance.messenger]} dot>{instanceShortLabel(instance)}</Badge>
            ) : null}
            <SettingsButton onClick={() => openSettings()} />
        </>
    );
    const nav = <Tabs tabs={[{id: 'send', label: 'Send'}, {id: 'tools', label: 'Tools'}]} value={mainTab} onChange={setMainTab} />;

    if (mainTab === 'tools') {
        return (
            <ToolsScreen
                header={header}
                nav={nav}
                client={client}
                instance={instance}
                instances={usable}
                mapping={mapping}
                config={config}
                inboundConfigured={inboundConfigured}
                isAdmin={view.me.isAdmin}
                canEditConfig={canEdit}
                onOpenSettings={openSettings}
            />
        );
    }
    if (!instance || !mapping || !setupComplete(setup)) {
        return (
            <Shell header={header}>
                {nav}
                {!instance && view.instances.length > 0 && <Notice tone="warning">No instance is allowed for you yet — a base owner has to tick one for you in Settings → People.</Notice>}
                <SetupChecklist state={setup} onOpen={openSettings} />
            </Shell>
        );
    }
    return (
        <SendScreen
            mapping={mapping}
            viewId={config.mapping.viewId}
            instance={instance}
            client={client}
            isAdmin={view.me.isAdmin}
            header={header}
            nav={nav}
        />
    );
}
