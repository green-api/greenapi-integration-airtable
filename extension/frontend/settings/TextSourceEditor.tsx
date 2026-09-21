import {FieldType, Table} from '@airtable/blocks/models';
import {FieldPicker, Input, Select} from '@airtable/blocks/ui';
import React from 'react';
import {Segment} from '../components/ui';
import {TextSource} from '../config/types';
import {TEXT_LIKE_FIELD_TYPES} from '../defaults';

type Mode = 'none' | 'field' | 'template';

export type Variant = 'template' | 'value' | 'url';

const VARIANT_LABELS: Record<Variant, string> = {
    template: 'Template',
    value: 'Fixed value',
    url: 'Fixed URL',
};

interface Props {
    table: Table;
    value: TextSource | null;
    onChange: (value: TextSource | null) => void;
    disabled: boolean;
    optional?: boolean;
    allowedTypes?: FieldType[];
    placeholder?: string;
    rows?: number;
    variant?: Variant;
}

export function TextSourceEditor({table, value, onChange, disabled, optional = false, allowedTypes = TEXT_LIKE_FIELD_TYPES, placeholder, rows = 4, variant = 'template'}: Props) {
    const mode: Mode = value === null ? 'none' : value.mode;
    const options: Array<{id: Mode; label: string}> = [
        ...(optional ? [{id: 'none' as Mode, label: 'None'}] : []),
        {id: 'field', label: 'From a field'},
        {id: 'template', label: VARIANT_LABELS[variant]},
    ];
    const setMode = (next: Mode) => {
        if (next === 'none') {
            onChange(null);
        } else if (next === 'field') {
            onChange({mode: 'field', fieldId: value?.mode === 'field' ? value.fieldId : null});
        } else {
            onChange({mode: 'template', template: value?.mode === 'template' ? value.template : ''});
        }
    };
    return (
        <div>
            <Segment options={options} value={mode} onChange={setMode} />
            {value?.mode === 'field' && (
                <div style={{marginTop: 8}}>
                    <FieldPicker
                        table={table}
                        field={value.fieldId ? table.getFieldByIdIfExists(value.fieldId) : null}
                        onChange={field => onChange({mode: 'field', fieldId: field?.id ?? null})}
                        allowedTypes={allowedTypes}
                        disabled={disabled}
                    />
                </div>
            )}
            {value?.mode === 'template' && (
                <div style={{marginTop: 8}}>
                    {variant === 'value' ? (
                        <Input value={value.template} onChange={e => onChange({mode: 'template', template: e.target.value})} disabled={disabled} placeholder={placeholder} />
                    ) : (
                        <TemplateEditor table={table} template={value.template} onChange={template => onChange({mode: 'template', template})} disabled={disabled} placeholder={placeholder} rows={rows} />
                    )}
                </div>
            )}
        </div>
    );
}

export function TemplateEditor({table, template, onChange, disabled, placeholder, rows = 4}: {
    table: Table;
    template: string;
    onChange: (template: string) => void;
    disabled: boolean;
    placeholder?: string;
    rows?: number;
}) {
    return (
        <div>
            <textarea
                className="ga-textarea"
                value={template}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                rows={rows}
                placeholder={placeholder ?? 'Hi {Name}, your order {Order} is ready.'}
            />
            <div className="ga-row" style={{marginTop: 6}}>
                <span className="ga-small ga-muted">Insert a field value with {'{Field name}'}</span>
                <Select
                    options={[{value: '', label: 'Insert field…'}, ...table.fields.map(f => ({value: f.name, label: f.name}))]}
                    value=""
                    onChange={name => name && onChange(`${template}{${String(name)}}`)}
                    disabled={disabled}
                    size="small"
                    width="11rem"
                />
            </div>
        </div>
    );
}
