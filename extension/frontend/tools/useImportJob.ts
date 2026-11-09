import {useCallback, useEffect, useState} from 'react';
import {AdapterClient, AdapterError, describeError} from '../api/adapterClient';
import {ImportJobView} from '../api/types';
import {JOB_POLL_INTERVAL_MS} from '../defaults';

export interface ImportJobState {
    job: ImportJobView | null;
    error: string | null;
    starting: boolean;
    active: boolean;
    start: (minutes: number) => Promise<void>;
}

export function isImportActive(job: ImportJobView | null): boolean {
    return job !== null && (job.status === 'queued' || job.status === 'running');
}

export function useImportJob(client: AdapterClient, idInstance: number | null): ImportJobState {
    const [job, setJob] = useState<ImportJobView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    const resume = useCallback(async (id: number) => {
        const latest = await client.latestImport(id);
        if (isImportActive(latest)) {
            setJob(latest);
        }
    }, [client]);

    useEffect(() => {
        setJob(null);
        setError(null);
        if (idInstance === null) {
            return;
        }
        resume(idInstance).catch(() => undefined);
    }, [idInstance, resume]);

    const active = isImportActive(job);
    const activeId = active ? job?.id ?? null : null;
    useEffect(() => {
        if (!activeId || idInstance === null) {
            return;
        }
        let cancelled = false;
        let timer: number | undefined;

        const poll = async () => {
            try {
                const next = await client.getImport(idInstance, activeId);
                if (cancelled) {
                    return;
                }
                setJob(next);
                setError(null);
                if (isImportActive(next)) {
                    timer = window.setTimeout(poll, JOB_POLL_INTERVAL_MS);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(describeError(e));
                    timer = window.setTimeout(poll, JOB_POLL_INTERVAL_MS);
                }
            }
        };
        timer = window.setTimeout(poll, JOB_POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [client, idInstance, activeId]);

    const start = useCallback(async (minutes: number) => {
        if (idInstance === null) {
            return;
        }
        setStarting(true);
        setError(null);
        try {
            setJob(await client.startImport(idInstance, minutes));
        } catch (e) {
            setError(describeError(e));
            if (e instanceof AdapterError && e.code === 'IMPORT_RUNNING') {
                await resume(idInstance).catch(() => undefined);
            }
        } finally {
            setStarting(false);
        }
    }, [client, idInstance, resume]);

    return {job, error, starting, active, start};
}
