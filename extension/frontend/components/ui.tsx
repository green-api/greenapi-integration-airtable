import {Button} from '@airtable/blocks/ui';
import React from 'react';

const LOGO_PATH = 'M28.834 0.016c-7.231,0.149 -14.359,3.105 -19.594,8.155 -5.446,5.168 -8.807,12.499 -9.184,20.044 -0.107,3.3 -0.021,6.606 -0.049,9.909 0.003,94.08 -0.005,188.161 0.004,282.24 0.107,7.262 2.671,14.425 6.963,20.226 3.318,4.45 7.887,8.183 13.309,9.559 3.443,0.901 7.122,0.668 10.479,-0.487 78.186,-23.931 156.376,-47.851 234.559,-71.791 6.585,-2.085 13.09,-4.86 18.519,-9.246 4.159,-3.35 7.52,-7.856 8.993,-13.067 0.879,-2.941 1.075,-6.034 1.007,-9.092 -0.005,-72.336 0.006,-144.671 -0.006,-217.008 -0.072,-7.412 -3.006,-14.748 -8.066,-20.113 -5.111,-5.508 -12.358,-8.907 -19.818,-9.289 -3.264,-0.108 -6.532,-0.021 -9.798,-0.049 -75.65,0.003 -151.302,-0.006 -226.953,0.004 -0.122,0.002 -0.244,0.003 -0.365,0.005zm164.759 178.884l-42.973 -0.001 0 -34.385 83.797 0c0.34,1.868 0.594,4.414 0.764,7.64 0.169,3.227 0.298,6.327 0.382,9.297 0.085,2.972 0.128,5.308 0.128,7.005 0,11.546 -2.08,22.117 -6.241,31.71 -4.16,9.594 -10.018,17.872 -17.575,24.834 -7.555,6.961 -16.428,12.353 -26.616,16.173 -10.187,3.821 -21.225,5.731 -33.111,5.731 -14.264,0 -27.126,-2.292 -38.587,-6.876 -11.463,-4.585 -21.352,-11.037 -29.674,-19.358 -8.32,-8.32 -14.687,-18.083 -19.102,-29.291 -4.415,-11.207 -6.622,-23.433 -6.622,-36.677 0,-13.245 2.377,-25.471 7.132,-36.678 4.754,-11.207 11.419,-20.97 19.993,-29.291 8.575,-8.32 18.764,-14.772 30.565,-19.357 11.801,-4.585 24.748,-6.876 38.842,-6.876 9.678,0 18.89,1.273 27.635,3.819 8.745,2.549 16.725,6.029 23.942,10.443 7.216,4.416 13.202,9.424 17.956,15.027l-26.743 28.019c-6.113,-5.774 -12.693,-10.316 -19.738,-13.627 -7.048,-3.311 -14.986,-4.967 -23.816,-4.967 -7.302,0 -14.051,1.316 -20.249,3.949 -6.199,2.631 -11.631,6.367 -16.3,11.207 -4.671,4.839 -8.279,10.526 -10.826,17.064 -2.548,6.537 -3.82,13.627 -3.82,21.268 0,7.641 1.357,14.688 4.075,21.14 2.716,6.453 6.495,12.099 11.335,16.938 4.839,4.84 10.484,8.617 16.936,11.334 6.454,2.717 13.415,4.076 20.887,4.076 5.263,0 10.145,-0.807 14.645,-2.42 4.5,-1.613 8.489,-3.821 11.972,-6.622 3.48,-2.802 6.196,-6.113 8.149,-9.935 1.65,-3.225 2.602,-6.664 2.858,-10.313z';

export function Logo({size = 22, className}: {size?: number; className?: string}) {
    return (
        <svg width={size} height={size * 1.19} viewBox="0 0 293.852 350.7" className={className} aria-hidden="true">
            <path d={LOGO_PATH} fill="currentColor" fillRule="nonzero" />
        </svg>
    );
}

export function Shell({header, footer, children}: {header: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode}) {
    return (
        <div className="ga-shell">
            <div className="ga-header">{header}</div>
            <div className="ga-content">{children}</div>
            {footer && <div className="ga-footer">{footer}</div>}
        </div>
    );
}

export function Brand({subtitle}: {subtitle?: React.ReactNode}) {
    return (
        <>
            <Logo size={18} className="ga-header__logo" />
            <span className="ga-header__title" style={{color: 'var(--ga-green-text)'}}>GREEN-API</span>
            <span className="ga-header__title ga-muted" style={{fontWeight: 500}}>for Airtable</span>
            {subtitle}
        </>
    );
}

export function Card({title, description, children, action}: {title?: string; description?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode}) {
    return (
        <section className="ga-card">
            {(title || action) && (
                <div className="ga-row ga-row--between" style={{marginBottom: description ? 0 : 10}}>
                    {title && <h3 className="ga-card__title">{title}</h3>}
                    {action}
                </div>
            )}
            {description && <p className="ga-card__desc">{description}</p>}
            {children}
        </section>
    );
}

export type Tone = 'green' | 'amber' | 'red' | 'gray' | 'orange' | 'blue' | 'violet';

export function Badge({tone, children, dot}: {tone: Tone; children: React.ReactNode; dot?: boolean}) {
    return (
        <span className={`ga-badge ga-badge--${tone}`}>
            {dot && <span className="ga-badge__dot" />}
            {children}
        </span>
    );
}

type ButtonProps = React.ComponentProps<typeof Button>;

export function PrimaryButton(props: ButtonProps) {
    return <Button {...props} className={`ga-btn-primary ${props.className ?? ''}`} />;
}

export function GhostButton(props: ButtonProps) {
    return <Button {...props} className={`ga-btn-ghost ${props.className ?? ''}`} />;
}

export function DangerButton(props: ButtonProps) {
    return <Button {...props} className={`ga-btn-danger ${props.className ?? ''}`} />;
}

export function Tabs<T extends string>({tabs, value, onChange}: {tabs: Array<{id: T; label: string}>; value: T; onChange: (id: T) => void}) {
    return (
        <div className="ga-tabs" role="tablist">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === value}
                    className={`ga-tab ${tab.id === value ? 'ga-tab--active' : ''}`}
                    onClick={() => onChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export function Segment<T extends string>({options, value, onChange}: {options: Array<{id: T; label: string}>; value: T; onChange: (id: T) => void}) {
    return (
        <div className="ga-segment" role="radiogroup">
            {options.map(option => (
                <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={option.id === value}
                    className={`ga-segment__btn ${option.id === value ? 'ga-segment__btn--active' : ''}`}
                    onClick={() => onChange(option.id)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function Field({label, hint, children}: {label: string; hint?: React.ReactNode; children: React.ReactNode}) {
    return (
        <div className="ga-field">
            <label className="ga-field__label">{label}</label>
            {children}
            {hint && <div className="ga-field__hint">{hint}</div>}
        </div>
    );
}

export function Notice({tone = 'info', children}: {tone?: 'info' | 'warning' | 'error' | 'success'; children: React.ReactNode}) {
    return <div className={`ga-notice ga-notice--${tone}`}>{children}</div>;
}

export function EmptyState({title, body, action}: {title: string; body: React.ReactNode; action?: React.ReactNode}) {
    return (
        <div className="ga-empty">
            <Logo size={44} className="ga-empty__icon" />
            <h2 className="ga-empty__title">{title}</h2>
            <p className="ga-empty__body">{body}</p>
            {action}
        </div>
    );
}

export function Stat({value, label, tone}: {value: React.ReactNode; label: string; tone?: 'green' | 'red'}) {
    return (
        <div className={`ga-stat ${tone ? `ga-stat--${tone}` : ''}`}>
            <div className="ga-stat__value">{value}</div>
            <div className="ga-stat__label">{label}</div>
        </div>
    );
}

export function Progress({value}: {value: number}) {
    return (
        <div className="ga-progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="ga-progress__bar" style={{width: `${Math.min(100, Math.max(0, value * 100))}%`}} />
        </div>
    );
}

export function Avatar({name, problem}: {name: string; problem?: boolean}) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('') || '#';
    return <div className={`ga-avatar ${problem ? 'ga-avatar--problem' : ''}`}>{initials}</div>;
}

export function Chip({on, children, onClick, disabled}: {on: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean}) {
    return (
        <button type="button" className={`ga-chip ${on ? 'ga-chip--on' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={on}>
            {children}
        </button>
    );
}

export function instanceStateTone(state: string | null): Tone {
    switch (state) {
        case 'authorized':
            return 'green';
        case 'starting':
        case 'yellowCard':
        case 'pendingPassword':
            return 'amber';
        case 'notAuthorized':
        case 'blocked':
        case 'suspended':
            return 'red';
        default:
            return 'gray';
    }
}
