const STORAGE_PREFIX = 'greenapi:instance:';

function storageKey(baseId: string): string {
    return `${STORAGE_PREFIX}${baseId}`;
}

export function readChosenInstance(baseId: string): number | null {
    try {
        const raw = window.localStorage.getItem(storageKey(baseId));
        const parsed = raw === null ? NaN : Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function writeChosenInstance(baseId: string, idInstance: number): void {
    try {
        window.localStorage.setItem(storageKey(baseId), String(idInstance));
    } catch {
        return;
    }
}
