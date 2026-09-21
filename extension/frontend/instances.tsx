import React from 'react';
import {InstanceView} from './api/types';
import {Badge} from './components/ui';
import {MESSENGER_LABELS, MESSENGER_TONES} from './defaults';

type Labelled = Pick<InstanceView, 'idInstance' | 'name' | 'messenger'>;

export function instanceName(instance: Labelled): string {
    return instance.name ? `${instance.name} (${instance.idInstance})` : String(instance.idInstance);
}

export function MessengerBadge({messenger}: {messenger: InstanceView['messenger']}) {
    return <Badge tone={MESSENGER_TONES[messenger]}>{MESSENGER_LABELS[messenger]}</Badge>;
}

export function instanceLabel(instance: Pick<InstanceView, 'idInstance' | 'name' | 'messenger'>): string {
    return `${instance.name ? `${instance.name} (${instance.idInstance})` : instance.idInstance} · ${MESSENGER_LABELS[instance.messenger]}`;
}

export function instanceShortLabel(instance: Pick<InstanceView, 'idInstance' | 'name' | 'messenger'>): string {
    return `${instance.name ?? instance.idInstance} · ${MESSENGER_LABELS[instance.messenger]}`;
}
