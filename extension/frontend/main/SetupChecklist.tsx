import React from 'react';
import {Card, GhostButton, PrimaryButton} from '../components/ui';
import {SettingsTab} from '../settings/SettingsScreen';

export interface SetupState {
    instance: boolean;
    recipients: boolean;
    message: boolean;
    receiving: boolean;
    isAdmin: boolean;
}

interface Step {
    done: boolean;
    title: string;
    detail: string;
    tab: SettingsTab;
    optional?: boolean;
    adminOnly?: boolean;
}

export function setupComplete(state: SetupState): boolean {
    return state.instance && state.recipients && state.message;
}

export function SetupChecklist({state, onOpen}: {state: SetupState; onOpen: (tab: SettingsTab) => void}) {
    const steps: Step[] = [
        {done: state.instance, title: 'Connect a GREEN-API instance', detail: 'The WhatsApp, Telegram or MAX account this base sends from. idInstance, apiTokenInstance and apiUrl are in the GREEN-API console.', tab: 'instances', adminOnly: true},
        {done: state.recipients, title: 'Choose who to message', detail: 'The table with your recipients and the column holding their phone number or chat id.', tab: 'sending'},
        {done: state.message, title: 'Choose what to send', detail: 'Text from a column or a template, a file, a location, a contact card, a poll or buttons.', tab: 'sending'},
        {done: state.receiving, title: 'Receive replies into the base', detail: 'Optional. Incoming messages and delivery statuses land in a messages table.', tab: 'receiving', optional: true, adminOnly: true},
    ];
    const next = steps.find(step => !step.done && !step.optional);
    return (
        <Card title="Set up in three steps" description="Everything else — checking numbers, importing history and contacts, automations — is under Tools once sending works.">
            <ol className="ga-steps">
                {steps.map((step, index) => {
                    const locked = step.adminOnly && !state.isAdmin;
                    return (
                        <li key={step.title} className={`ga-step ${step.done ? 'ga-step--done' : ''}`}>
                            <span className="ga-step__mark">{step.done ? '✓' : index + 1}</span>
                            <div className="ga-step__body">
                                <div className="ga-step__title">
                                    {step.title}
                                    {step.optional && <span className="ga-muted ga-small"> · optional</span>}
                                </div>
                                <div className="ga-small ga-muted">{locked && !step.done ? 'A base owner has to do this.' : step.detail}</div>
                            </div>
                            {!step.done && !locked && (
                                step === next
                                    ? <PrimaryButton onClick={() => onOpen(step.tab)} size="small">Set up</PrimaryButton>
                                    : <GhostButton onClick={() => onOpen(step.tab)} size="small">Open</GhostButton>
                            )}
                        </li>
                    );
                })}
            </ol>
        </Card>
    );
}
