import {Table} from '@airtable/blocks/models';
import {Input, Select, Switch} from '@airtable/blocks/ui';
import React from 'react';
import {Field, GhostButton, Notice, Segment} from '../components/ui';
import {ButtonConfig, MessageConfig, MessageType} from '../config/types';
import {defaultMessage} from '../config/parse';
import {ATTACHMENT_FIELD_TYPES, MESSAGE_TYPE_LABELS, NUMBER_FIELD_TYPES, PHONE_FIELD_TYPES} from '../defaults';
import {TextSourceEditor} from './TextSourceEditor';

const MAX_POLL_OPTIONS = 12;
const MAX_BUTTONS = 3;
const BUTTON_TYPE_OPTIONS = [
    {value: 'reply', label: 'Reply'},
    {value: 'url', label: 'Open URL'},
    {value: 'call', label: 'Call'},
    {value: 'copy', label: 'Copy code'},
];

interface Props {
    table: Table;
    message: MessageConfig;
    onChange: (message: MessageConfig) => void;
    disabled: boolean;
}

function ButtonsEditor({table, buttons, onChange, disabled}: {
    table: Table;
    buttons: ButtonConfig[];
    onChange: (buttons: ButtonConfig[]) => void;
    disabled: boolean;
}) {
    const update = (index: number, patch: Partial<ButtonConfig>) => onChange(buttons.map((b, i) => (i === index ? {...b, ...patch} : b)));
    const remove = (index: number) => onChange(buttons.filter((_, i) => i !== index));
    const hasReply = buttons.some(b => b.type === 'reply');
    const hasAction = buttons.some(b => b.type !== 'reply');
    return (
        <div>
            {buttons.map((button, index) => (
                <div key={index} className="ga-list" style={{marginBottom: 8}}>
                    <div className="ga-list__item" style={{flexDirection: 'column', alignItems: 'stretch', gap: 8}}>
                        <div className="ga-row">
                            <Select
                                options={BUTTON_TYPE_OPTIONS}
                                value={button.type}
                                onChange={type => update(index, {type: type as ButtonConfig['type'], value: type === 'reply' ? null : button.value ?? {mode: 'template', template: ''}})}
                                disabled={disabled}
                                size="small"
                                width="9rem"
                            />
                            <Input value={button.text} onChange={e => update(index, {text: e.target.value})} placeholder="Button text" disabled={disabled} size="small" />
                            <GhostButton onClick={() => remove(index)} disabled={disabled || buttons.length === 1} size="small" icon="x" aria-label="Remove button" />
                        </div>
                        {button.type !== 'reply' && (
                            <Field label={button.type === 'url' ? 'URL' : button.type === 'call' ? 'Phone number' : 'Code to copy'}>
                                <TextSourceEditor table={table} value={button.value} onChange={value => update(index, {value})} disabled={disabled} rows={2} placeholder={button.type === 'url' ? 'https://example.com/{Order}' : ''} />
                            </Field>
                        )}
                    </div>
                </div>
            ))}
            {hasReply && hasAction && <Notice tone="warning">WhatsApp cannot mix reply buttons with URL / call / copy buttons in one message.</Notice>}
            <GhostButton onClick={() => onChange([...buttons, {type: 'reply', text: '', value: null}])} disabled={disabled || buttons.length >= MAX_BUTTONS} size="small" icon="plus">Add button</GhostButton>
        </div>
    );
}

export function MessageEditor({table, message, onChange, disabled}: Props) {
    const typeOptions = (Object.keys(MESSAGE_TYPE_LABELS) as MessageType[]).map(type => ({id: type, label: MESSAGE_TYPE_LABELS[type]}));
    return (
        <div>
            <Field label="Message type" hint={message.type === 'buttons' ? 'WhatsApp only — Telegram and MAX instances skip these rows.' : message.type === 'poll' ? 'On Telegram polls go only to groups — rows with a personal chat are skipped.' : undefined}>
                <Segment options={typeOptions} value={message.type} onChange={type => onChange(defaultMessage(type))} />
            </Field>

            {message.type === 'text' && (
                <Field label="Text">
                    <TextSourceEditor table={table} value={message.text} onChange={text => text && onChange({...message, text})} disabled={disabled} />
                </Field>
            )}

            {message.type === 'file' && (
                <>
                    <Field label="File" hint="From an attachment field (first file in the cell) or a URL field — or a fixed public link, same file for everyone.">
                        <TextSourceEditor table={table} value={message.file} onChange={file => file && onChange({...message, file})} disabled={disabled} allowedTypes={ATTACHMENT_FIELD_TYPES} variant="url" rows={2} placeholder="https://example.com/files/{Order}.pdf" />
                    </Field>
                    <Field label="Caption (optional)">
                        <TextSourceEditor table={table} value={message.caption} onChange={caption => onChange({...message, caption})} disabled={disabled} optional />
                    </Field>
                </>
            )}

            {message.type === 'location' && (
                <>
                    <Field label="Latitude">
                        <TextSourceEditor table={table} value={message.latitude} onChange={latitude => latitude && onChange({...message, latitude})} disabled={disabled} allowedTypes={NUMBER_FIELD_TYPES} variant="value" placeholder="51.5074" />
                    </Field>
                    <Field label="Longitude">
                        <TextSourceEditor table={table} value={message.longitude} onChange={longitude => longitude && onChange({...message, longitude})} disabled={disabled} allowedTypes={NUMBER_FIELD_TYPES} variant="value" placeholder="-0.1278" />
                    </Field>
                    <Field label="Place name (optional)">
                        <TextSourceEditor table={table} value={message.name} onChange={name => onChange({...message, name})} disabled={disabled} optional variant="value" placeholder="Our office" />
                    </Field>
                    <Field label="Address (optional)">
                        <TextSourceEditor table={table} value={message.address} onChange={address => onChange({...message, address})} disabled={disabled} optional variant="value" placeholder="221B Baker Street" />
                    </Field>
                </>
            )}

            {message.type === 'contact' && (
                <>
                    <Field label="Contact phone">
                        <TextSourceEditor table={table} value={message.phone} onChange={phone => phone && onChange({...message, phone})} disabled={disabled} allowedTypes={PHONE_FIELD_TYPES} variant="value" placeholder="+1 555 0100" />
                    </Field>
                    <Field label="First name (optional)">
                        <TextSourceEditor table={table} value={message.firstName} onChange={firstName => onChange({...message, firstName})} disabled={disabled} optional variant="value" />
                    </Field>
                    <Field label="Last name (optional)">
                        <TextSourceEditor table={table} value={message.lastName} onChange={lastName => onChange({...message, lastName})} disabled={disabled} optional variant="value" />
                    </Field>
                    <Field label="Company (optional)">
                        <TextSourceEditor table={table} value={message.company} onChange={company => onChange({...message, company})} disabled={disabled} optional variant="value" />
                    </Field>
                </>
            )}

            {message.type === 'poll' && (
                <>
                    <Field label="Question">
                        <TextSourceEditor table={table} value={message.question} onChange={question => question && onChange({...message, question})} disabled={disabled} rows={2} placeholder="Which slot suits you, {Name}?" />
                    </Field>
                    <Field label="Options" hint="The same options are offered to every recipient.">
                        {message.options.map((option, index) => (
                            <div key={index} className="ga-row" style={{marginBottom: 6}}>
                                <Input value={option} onChange={e => onChange({...message, options: message.options.map((o, i) => (i === index ? e.target.value : o))})} placeholder={`Option ${index + 1}`} disabled={disabled} size="small" />
                                <GhostButton onClick={() => onChange({...message, options: message.options.filter((_, i) => i !== index)})} disabled={disabled || message.options.length <= 2} size="small" icon="x" aria-label="Remove option" />
                            </div>
                        ))}
                        <GhostButton onClick={() => onChange({...message, options: [...message.options, '']})} disabled={disabled || message.options.length >= MAX_POLL_OPTIONS} size="small" icon="plus">Add option</GhostButton>
                    </Field>
                    <Switch value={message.multipleAnswers} onChange={multipleAnswers => onChange({...message, multipleAnswers})} label="Allow multiple answers" disabled={disabled} width="auto" />
                </>
            )}

            {message.type === 'buttons' && (
                <>
                    <Field label="Header (optional)">
                        <TextSourceEditor table={table} value={message.header} onChange={header => onChange({...message, header})} disabled={disabled} optional rows={2} />
                    </Field>
                    <Field label="Body">
                        <TextSourceEditor table={table} value={message.body} onChange={body => body && onChange({...message, body})} disabled={disabled} />
                    </Field>
                    <Field label="Footer (optional)">
                        <TextSourceEditor table={table} value={message.footer} onChange={footer => onChange({...message, footer})} disabled={disabled} optional rows={2} />
                    </Field>
                    <Field label="Buttons" hint="Up to three. Reply buttons cannot be mixed with URL / call / copy.">
                        <ButtonsEditor table={table} buttons={message.buttons} onChange={buttons => onChange({...message, buttons})} disabled={disabled} />
                    </Field>
                </>
            )}
        </div>
    );
}
