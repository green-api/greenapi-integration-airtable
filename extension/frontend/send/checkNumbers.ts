import {Field, FieldType, Record, Table} from '@airtable/blocks/models';
import {CheckResult} from '../api/types';
import {CHECK_BATCH_SIZE, CHECK_CHOICE_NO, CHECK_CHOICE_YES, WRITE_BACK_BATCH_SIZE} from '../defaults';

type Choice = {id?: string; name: string; color?: string};

export interface CheckSummary {
    checked: number;
    found: number;
    missing: number;
    failed: number;
    unwritable: string[];
}

function selectChoices(field: Field): Choice[] {
    const options = field.options as {choices?: Choice[]} | null;
    return options?.choices ?? [];
}

export async function ensureCheckChoices(field: Field | null): Promise<string[]> {
    if (!field || field.type !== FieldType.SINGLE_SELECT) {
        return [];
    }
    const present = new Set(selectChoices(field).map(choice => choice.name));
    const missing = [CHECK_CHOICE_YES, CHECK_CHOICE_NO].filter(name => !present.has(name));
    if (missing.length === 0) {
        return [];
    }
    const options = {choices: [...selectChoices(field), ...missing.map(name => ({name}))]};
    if (!field.hasPermissionToUpdateOptions(options)) {
        return missing;
    }
    await field.updateOptionsAsync(options);
    return [];
}

function checkValue(field: Field, exists: boolean): unknown {
    if (field.type === FieldType.CHECKBOX) {
        return exists;
    }
    const name = exists ? CHECK_CHOICE_YES : CHECK_CHOICE_NO;
    return field.type === FieldType.SINGLE_SELECT ? {name} : name;
}

export function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

export async function checkAndWrite(
    table: Table,
    checkField: Field,
    chatIdField: Field | null,
    records: Array<{record: Record; phone: string}>,
    check: (phones: string[]) => Promise<CheckResult[]>,
): Promise<CheckSummary> {
    const unwritable = await ensureCheckChoices(checkField);
    const summary: CheckSummary = {checked: 0, found: 0, missing: 0, failed: 0, unwritable};
    for (const batch of chunk(records, CHECK_BATCH_SIZE)) {
        const results = await check(batch.map(r => r.phone));
        const updates: Array<{id: string; fields: {[fieldId: string]: unknown}}> = [];
        results.forEach((result, index) => {
            summary.checked += 1;
            if (result.exists === null) {
                summary.failed += 1;
                return;
            }
            summary.found += result.exists ? 1 : 0;
            summary.missing += result.exists ? 0 : 1;
            const fields: {[fieldId: string]: unknown} = {};
            if (unwritable.length === 0) {
                fields[checkField.id] = checkValue(checkField, result.exists);
            }
            if (chatIdField && result.chatId) {
                fields[chatIdField.id] = result.chatId;
            }
            if (Object.keys(fields).length > 0) {
                updates.push({id: batch[index].record.id, fields});
            }
        });
        for (const part of chunk(updates, WRITE_BACK_BATCH_SIZE)) {
            await table.updateRecordsAsync(part);
        }
    }
    return summary;
}
