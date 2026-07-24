// Centralised palette — every color in castwatch resolves through this module.
// 24-bit RGB so GitHub Actions web logs match local terminals; chalk degrades.

import chalk, {type ChalkInstance} from 'chalk';
import type {DeploymentEventType, ServiceState} from './castellan/types.js';

/** Tokyo Night-ish palette. Picked to read well on both light and dark TTYs. */
export const palette = {
    fg: [205, 214, 244] as const,
    fgMuted: [148, 158, 178] as const,
    fgDim: [88, 91, 112] as const,
    primary: [137, 180, 250] as const,
    accent: [203, 166, 247] as const,
    success: [166, 227, 161] as const,
    warning: [250, 179, 135] as const,
    error: [243, 139, 168] as const,
    info: [148, 226, 213] as const,
    pending: [249, 226, 175] as const,
    rolling: [137, 220, 235] as const,
};

type RGB = readonly [number, number, number];

function rgb(color: RGB): ChalkInstance {

    return chalk.rgb(color[0], color[1], color[2]);

}

function bgRgb(color: RGB): ChalkInstance {

    return chalk.bgRgb(color[0], color[1], color[2]);

}

export const c = {
    fg: rgb(palette.fg),
    muted: rgb(palette.fgMuted),
    dim: rgb(palette.fgDim),
    primary: rgb(palette.primary),
    accent: rgb(palette.accent),
    success: rgb(palette.success),
    warning: rgb(palette.warning),
    error: rgb(palette.error),
    info: rgb(palette.info),
    pending: rgb(palette.pending),
    rolling: rgb(palette.rolling),
};

/** Stylized status pill — `bg + bold + black text` reads well in CI logs. */
export function pill(
    label: string,
    kind: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'pending' | 'rolling' = 'info',
): string {

    const pad = ` ${label} `;
    const black = chalk.rgb(15, 15, 25).bold;

    switch (kind) {

        case 'success': return bgRgb(palette.success)(black(pad));
        case 'warning': return bgRgb(palette.warning)(black(pad));
        case 'error': return bgRgb(palette.error)(black(pad));
        case 'primary': return bgRgb(palette.primary)(black(pad));
        case 'pending': return bgRgb(palette.pending)(black(pad));
        case 'rolling': return bgRgb(palette.rolling)(black(pad));
        case 'info':
        default: return bgRgb(palette.info)(black(pad));

    }

}

export function colorServiceState(state: ServiceState): string {

    switch (state) {

        case 'stable':
        case 'idle':
            return pill(state.toUpperCase(), 'success');
        case 'checking':
            return pill('CHECKING', 'pending');
        case 'updating':
        case 'verifying':
            return pill(state.toUpperCase(), 'rolling');
        case 'rollback':
            return pill('ROLLBACK', 'warning');
        case 'failed':
            return pill('FAILED', 'error');
        default:
            return pill(String(state).toUpperCase(), 'warning');

    }

}

export function colorEventType(type: DeploymentEventType): string {

    switch (type) {

        case 'deploy':
            return pill('DEPLOY', 'rolling');
        case 'check':
            return pill('CHECK', 'info');
        case 'rollback':
            return pill('ROLLBACK', 'warning');
        case 'failure':
            return pill('FAILURE', 'error');
        default:
            return pill(String(type).toUpperCase(), 'info');

    }

}

export function shortDigest(digest: string | null): string {

    if (!digest) return '—';
    if (digest.startsWith('sha256:') && digest.length > 19) {

        return digest.slice(7, 19);

    }

    return digest.length > 12 ? digest.slice(0, 12) : digest;

}
