import {Dialog, Heading, Text} from '@airtable/blocks/ui';
import React, {useEffect, useState} from 'react';
import {AdapterClient, describeError} from '../api/adapterClient';
import {InstanceView, QrView} from '../api/types';
import {GhostButton, Notice} from '../components/ui';
import {QR_REFRESH_MS} from '../defaults';
import {instanceLabel} from '../instances';

interface Props {
    client: AdapterClient;
    instance: InstanceView;
    onAuthorized: () => Promise<void>;
    onClose: () => void;
}

export function QrDialog({client, instance, onAuthorized, onClose}: Props) {
    const [qr, setQr] = useState<QrView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            try {
                const next = await client.qr(instance.idInstance);
                if (stopped) {
                    return;
                }
                setQr(next);
                setError(null);
                if (next.status === 'authorized') {
                    await onAuthorized();
                    onClose();
                    return;
                }
            } catch (e) {
                if (!stopped) {
                    setError(describeError(e));
                }
            }
            if (!stopped) {
                timer = setTimeout(() => void tick(), QR_REFRESH_MS);
            }
        };
        void tick();
        return () => {
            stopped = true;
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [client, instance.idInstance, onAuthorized, onClose]);

    return (
        <Dialog onClose={onClose} width="340px">
            <Dialog.CloseButton />
            <Heading size="small">Link {instanceLabel(instance)}</Heading>
            <Text size="small" textColor="light" marginBottom={2}>
                On the phone: {instance.messenger === 'whatsapp' ? 'WhatsApp → Linked devices → Link a device' : instance.messenger === 'telegram' ? 'Telegram → Settings → Devices → Link Desktop Device' : 'MAX → Settings → Devices'} and scan. The code refreshes automatically.
            </Text>
            {error && <Notice tone="error">{error}</Notice>}
            {qr?.status === 'qr' && qr.image && <img src={`data:image/png;base64,${qr.image}`} alt="QR code" style={{width: '100%', imageRendering: 'pixelated'}} />}
            {qr?.status === 'error' && <Notice tone="warning">{qr.message ?? 'GREEN-API could not produce a code right now.'}</Notice>}
            {!qr && !error && <div className="ga-small ga-muted">Requesting a code…</div>}
            <div className="ga-row" style={{marginTop: 10}}>
                <GhostButton onClick={onClose} size="small">Close</GhostButton>
            </div>
        </Dialog>
    );
}
