// Centralised palette — every color in composewatch resolves through this module.
//
// We deliberately use 24-bit RGB colors (not the 16 ANSI palette) because:
//   1. Most modern terminals (iTerm2, Alacritty, kitty, Ghostty, Warp) render
//      them natively and they look gorgeous;
//   2. GitHub Actions' web log viewer renders 24-bit ANSI faithfully — `CI`
//      runs get the same palette without needing a fallback;
//   3. Old 16-color schemes look muddy and clash with user terminal themes.
//
// Chalk auto-degrades to 8-bit / 16-color on terminals that don't support
// truecolor, so callers don't need to branch.

import chalk, {type ChalkInstance} from 'chalk';

/** Tokyo Night-ish palette. Picked to read well on both light and dark TTYs. */
export const palette = {
    fg: [205, 214, 244] as const,
    fgMuted: [148, 158, 178] as const,
    fgDim: [88, 91, 112] as const,
    bg: [30, 30, 46] as const,
    bgPanel: [24, 24, 37] as const,

    // Semantic
    primary: [137, 180, 250] as const, // soft blue
    accent: [203, 166, 247] as const, // lavender
    success: [166, 227, 161] as const, // mint green
    warning: [250, 179, 135] as const, // peach
    error: [243, 139, 168] as const, // rose
    info: [148, 226, 213] as const, // teal
    pending: [249, 226, 175] as const, // soft yellow
    rolling: [137, 220, 235] as const, // sky cyan

    badgeBg: [49, 50, 68] as const,
    border: [69, 71, 90] as const,
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

export const bg = {
    panel: bgRgb(palette.bgPanel),
    badge: bgRgb(palette.badgeBg),
    success: bgRgb(palette.success),
    warning: bgRgb(palette.warning),
    error: bgRgb(palette.error),
    primary: bgRgb(palette.primary),
};

/** Stylized status pill — `bg + bold + black text` reads well in CI logs. */
export function pill(label: string, kind: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'pending' | 'rolling' = 'info'): string {

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

/** Color a free-form docker/compose status line. */
export function colorStatusMessage(message: string): string {

    const lower = message.toLowerCase();

    if (lower.includes('failed') || lower.includes('unhealthy') || lower.includes('error') || lower.includes('exit')) {

        return c.error(message);

}
    if (lower.includes('restart') || lower.includes('starting') || lower.includes('created')) {

        return c.warning(message);

}
    if (lower.includes('healthy') || lower.includes('running') || lower.includes('up ')) {

        return c.success(message);

}
    return c.info(message);

}

export function colorRolloutKind(kind: string): string {

    switch (kind) {

        case 'success':
        case 'healthy': return pill('HEALTHY', 'success');
        case 'deploying':
        case 'pending': return pill('DEPLOYING', 'rolling');
        case 'failed': return pill('FAILED', 'error');
        default: return pill(kind.toUpperCase() || 'UNKNOWN', 'warning');

}

}

export function colorContainerState(state: string): string {

    switch (state) {

        case 'running': return c.success(state);
        case 'restarting':
        case 'created': return c.pending(state);
        case 'exited':
        case 'dead':
        case 'paused': return c.warning(state);
        default: return c.muted(state);

}

}

export function colorHealth(status: string | null | undefined): string {

    if (!status || status === 'none') return c.dim('—');
    switch (status) {

        case 'healthy': return `${c.success('●')} ${c.success(status)}`;
        case 'unhealthy': return `${c.error('●')} ${c.error(status)}`;
        case 'starting': return `${c.pending('●')} ${c.pending(status)}`;
        case 'unknown': return `${c.dim('●')} ${c.dim(status)}`;
        default: return c.muted(status);

}

}
