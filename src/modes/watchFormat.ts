// Pure layout helpers for the watch renderer. Kept free of chalk so the exact
// strings can be unit-tested; color is applied by the caller in watch.ts.

import type {DeploymentEventType, ServiceState} from '../castellan/types.js';
import {shortDigest} from '../theme.js';

/** Human duration: `47s` under a minute, `2m 3s` beyond it. */
export function formatDuration(ms: number): string {

    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

}

/**
 * Idle-poll heartbeat: cycling dots + current state(s) + timeout proximity.
 * `tick` advances each quiet poll (0 → `.`, 1 → `..`, 2 → `...`, …).
 */
export function formatWatchHeartbeat(opts: {
    elapsedMs: number;
    timeoutMs: number;
    states: string[];
    tick: number;
}): string {

    const dots = '.'.repeat((Math.max(0, opts.tick) % 3) + 1);
    const elapsed = formatDuration(opts.elapsedMs);
    const remaining = formatDuration(Math.max(0, opts.timeoutMs - opts.elapsedMs));
    const stateLabel = opts.states.length > 0 ? opts.states.join(', ') : 'waiting';

    return `· waiting${dots} ${stateLabel} — ${elapsed} elapsed, ${remaining} left`;

}

/** `from` alone, or `from → to` when the digest advanced. */
export function digestTransition(from: string | null, to: string | null): string {

    const fromShort = shortDigest(from);

    if (!to || to === from) return fromShort;

    return `${fromShort} → ${shortDigest(to)}`;

}

/** Emoji for a Castellan service state. */
export function stateEmoji(state: ServiceState): string {

    switch (state) {

        case 'stable':
        case 'idle':
            return '✓';
        case 'checking':
            return '🔎';
        case 'updating':
            return '🚀';
        case 'rollback':
            return '↩️';
        case 'failed':
            return '❌';
        default:
            return '·';

    }

}

/** Emoji for a Castellan history event type. */
export function eventEmoji(type: DeploymentEventType): string {

    switch (type) {

        case 'deploy':
            return '📥';
        case 'check':
            return '🔎';
        case 'rollback':
            return '↩️';
        case 'failure':
            return '❌';
        default:
            return '·';

    }

}
