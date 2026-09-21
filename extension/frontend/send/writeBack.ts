import {Field, FieldType, Table} from '@airtable/blocks/models';
import {STATUS_CHOICES, STATUS_FAILED, STATUS_SENT, STATUS_SKIPPED, WRITE_BACK_BATCH_SIZE} from '../defaults';
import {JobItemView, JobWriteBack} from '../api/types';
import {ResolvedMapping} from './compose';

type RecordUpdate = {id: string; fields: {[fieldId: string]: unknown}};
type Choice = {id?: string; name: string; color?: string};

function statusName(item: JobItemView): string {
    if (item.status === 'sent') {
        return STATUS_SENT;
    }
    return item.status === 'skipped' ? STATUS_SKIPPED : STATUS_FAILED;
}

function statusText(item: JobItemView): string {
    const name = statusName(item);
    return item.status !== 'sent' && item.error ? `${name}: ${item.error}` : name;
}

function selectChoices(field: Field): Choice[] {
    const options = field.options as {choices?: Choice[]} | null;
    return options?.choices ?? [];
}

function missingChoices(field: Field): string[] {
    const present = new Set(selectChoices(field).map(choice => choice.name));
    return STATUS_CHOICES.filter(name => !present.has(name));
}

export function hasWriteBack(mapping: ResolvedMapping): boolean {
    return Boolean(mapping.statusField || mapping.idMessageField || mapping.sentAtField);
}

export function jobWriteBack(mapping: ResolvedMapping): JobWriteBack {
    return {
        tableId: mapping.table.id,
        statusFieldId: mapping.statusField?.id ?? null,
        statusFieldType: mapping.statusField ? (mapping.statusField.type === FieldType.SINGLE_SELECT ? 'singleSelect' : 'text') : null,
    };
}

export async function ensureStatusChoices(field: Field | null): Promise<string[]> {
    if (!field || field.type !== FieldType.SINGLE_SELECT) {
        return [];
    }
    const missing = missingChoices(field);
    if (missing.length === 0) {
        return [];
    }
    const options = {choices: [...selectChoices(field), ...missing.map(name => ({name}))]};
    if (!field.hasPermissionToUpdateOptions(options)) {
        return missing;
    }
    await field.updateOptionsAsync(options);
    return missingChoices(field);
}

function statusValue(field: Field, item: JobItemView): unknown {
    if (field.type !== FieldType.SINGLE_SELECT) {
        return statusText(item);
    }
    const name = statusName(item);
    return selectChoices(field).some(choice => choice.name === name) ? {name} : undefined;
}

function toUpdate(item: JobItemView, mapping: ResolvedMapping, now: string): RecordUpdate | null {
    const fields: RecordUpdate['fields'] = {};
    if (mapping.statusField) {
        const value = statusValue(mapping.statusField, item);
        if (value !== undefined) {
            fields[mapping.statusField.id] = value;
        }
    }
    if (mapping.idMessageField) {
        fields[mapping.idMessageField.id] = item.idMessage ?? '';
    }
    if (mapping.sentAtField && item.status === 'sent') {
        fields[mapping.sentAtField.id] = now;
    }
    return item.recordId && Object.keys(fields).length > 0 ? {id: item.recordId, fields} : null;
}

export async function writeBackItems(table: Table, mapping: ResolvedMapping, items: JobItemView[]): Promise<void> {
    const now = new Date().toISOString();
    const updates = items
        .map(item => toUpdate(item, mapping, now))
        .filter((update): update is RecordUpdate => update !== null);
    for (let i = 0; i < updates.length; i += WRITE_BACK_BATCH_SIZE) {
        const batch = updates.slice(i, i + WRITE_BACK_BATCH_SIZE);
        if (table.hasPermissionToUpdateRecords(batch)) {
            await table.updateRecordsAsync(batch);
        }
    }
}
