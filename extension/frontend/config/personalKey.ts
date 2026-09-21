import {useCallback, useEffect, useState} from 'react';

const STORAGE_PREFIX = 'greenapi:personalKey:';

function storageKey(baseId: string, adapterUrl: string): string {
    return `${STORAGE_PREFIX}${baseId}:${adapterUrl}`;
}

export function readPersonalKey(baseId: string, adapterUrl: string): string | null {
    try {
        return window.localStorage.getItem(storageKey(baseId, adapterUrl));
    } catch {
        return null;
    }
}

export function writePersonalKey(baseId: string, adapterUrl: string, key: string | null): void {
    try {
        if (key) {
            window.localStorage.setItem(storageKey(baseId, adapterUrl), key);
        } else {
            window.localStorage.removeItem(storageKey(baseId, adapterUrl));
        }
    } catch {
        return;
    }
}

export function usePersonalKey(baseId: string, adapterUrl: string): [string | null, (key: string | null) => void] {
    const [key, setKey] = useState<string | null>(() => readPersonalKey(baseId, adapterUrl));
    useEffect(() => {
        setKey(readPersonalKey(baseId, adapterUrl));
    }, [baseId, adapterUrl]);
    const update = useCallback((next: string | null) => {
        writePersonalKey(baseId, adapterUrl, next);
        setKey(next);
    }, [baseId, adapterUrl]);
    return [key, update];
}
