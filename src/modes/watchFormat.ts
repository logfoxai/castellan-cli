// Pure layout helpers for the watch renderer. Kept free of chalk so the exact
// strings can be unit-tested; color is applied by the caller in watch.ts.

import {shortDigest} from '../theme.js';

/** Column width for the state pill — fits ` VERIFYING ` (the longest state). */
export const STATE_CELL_WIDTH = 11;

/** Column width for the event-type pill — fits ` ROLLBACK ` (the longest type). */
export const EVENT_CELL_WIDTH = 10;

/** Human duration: `47s` under a minute, `2m 3s` beyond it. */
export function formatDuration(ms: number): string {

    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

}

/**
 * Right-pad `rendered` to `width` columns using its known visible length.
 * `visibleLen` is passed explicitly because `rendered` may contain ANSI codes
 * whose bytes must not count toward the column width.
 */
export function padVisible(rendered: string, visibleLen: number, width: number): string {

    return rendered + ' '.repeat(Math.max(0, width - visibleLen));

}

/** `from` alone, or `from → to` when the digest advanced. */
export function digestTransition(from: string | null, to: string | null): string {

    const fromShort = shortDigest(from);

    if (!to || to === from) return fromShort;

    return `${fromShort} → ${shortDigest(to)}`;

}
