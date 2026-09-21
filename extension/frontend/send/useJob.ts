import {useCallback, useEffect, useRef, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {JobItemView, JobView} from '../api/types';
import {JOB_POLL_INTERVAL_MS} from '../defaults';

export interface JobState {
    job: JobView | null;
    error: string | null;
    busy: boolean;
}

const TERMINAL_ITEM = new Set(['sent', 'failed', 'skipped']);

export function isJobActive(job: JobView | null): boolean {
    return job !== null && (job.status === 'queued' || job.status === 'running');
}

export function useJob(
    client: AdapterClient | null,
    onItemsSettled: (items: JobItemView[]) => Promise<void>,
): JobState & {track: (jobId: string) => void; cancel: () => Promise<void>; reset: () => void} {
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<JobView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const settled = useRef(new Set<string>());
    const settle = useRef(onItemsSettled);
    settle.current = onItemsSettled;

    useEffect(() => {
        if (!client || !jobId) {
            return;
        }
        let cancelled = false;
        let timer: number | undefined;

        const poll = async () => {
            try {
                const next = await client.getJob(jobId);
                if (cancelled) {
                    return;
                }
                setJob(next);
                setError(null);
                const fresh = next.items.filter(item => item.recordId && TERMINAL_ITEM.has(item.status) && !settled.current.has(item.recordId));
                if (fresh.length > 0) {
                    fresh.forEach(item => settled.current.add(item.recordId as string));
                    await settle.current(fresh);
                }
                if (isJobActive(next)) {
                    timer = window.setTimeout(poll, JOB_POLL_INTERVAL_MS);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(describeError(e));
                    timer = window.setTimeout(poll, JOB_POLL_INTERVAL_MS);
                }
            }
        };
        void poll();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [client, jobId]);

    const track = useCallback((id: string) => {
        settled.current = new Set();
        setJob(null);
        setError(null);
        setJobId(id);
    }, []);

    const cancel = useCallback(async () => {
        if (!client || !jobId) {
            return;
        }
        setBusy(true);
        try {
            await client.cancelJob(jobId);
        } catch (e) {
            setError(describeError(e));
        } finally {
            setBusy(false);
        }
    }, [client, jobId]);

    const reset = useCallback(() => {
        setJobId(null);
        setJob(null);
        setError(null);
    }, []);

    return {job, error, busy, track, cancel, reset};
}
