import {Box, Text} from 'ink';
import React from 'react';
import {Panel, colors, Muted} from '../theme.js';
import type {LogLine} from '../../types.js';

interface Props {
    lines: LogLine[];
    focused: boolean;
    maxRows: number;
    scroll: number;
    started: boolean;
    error: string | null;
    flexGrow?: number;
}

export function LogsPanel({
    lines, focused, maxRows, scroll, started, error, flexGrow,
}: Props): React.ReactElement {

    const end = Math.max(0, lines.length - scroll);
    const start = Math.max(0, end - maxRows);
    const visible = lines.slice(start, end);
    const hiddenAbove = start;
    const live = scroll === 0;

    return (
        <Panel title="6 · Logs" focused={focused} accentKind="accent" flexGrow={flexGrow}>
            {!started ? <Muted>fetching compose logs over SSH…</Muted> : null}
            {error ? <Text color={colors.error}>error: {error}</Text> : null}
            {started ? (
                <Box>
                    {live
                        ? <Text color={colors.success}>● LIVE</Text>
                        : <Text color={colors.pending}>⏸ ↑ +{scroll}</Text>}
                    {hiddenAbove > 0 ? <Muted>  {hiddenAbove} older above</Muted> : null}
                    {!live ? <Muted>  · Esc/G live · ↑↓ PgUp/PgDn scroll</Muted> : null}
                </Box>
            ) : null}
            {started && lines.length === 0
                ? <Muted>no log lines yet — waiting for output…</Muted>
                : null}
            {visible.map((line, idx) => (
                <Box key={`${line.timestamp.getTime()}-${start + idx}`}>
                    <Text color={colors.dim}>{line.timestamp.toISOString().slice(11, 19)} </Text>
                    <Text color={colors.muted}>{truncate(line.stream || '?', 12)} </Text>
                    <Text color={severityColor(line.severity)}>{truncate(line.message, 120)}</Text>
                </Box>
            ))}
        </Panel>
    );

}

function severityColor(s: LogLine['severity']): string {

    switch (s) {

        case 'error': return colors.error;
        case 'warn': return colors.warning;
        case 'debug': return colors.dim;
        default: return colors.fg;

}

}

function truncate(s: string, n: number): string {

    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;

}
