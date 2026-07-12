import {Box, Text} from 'ink';
import React from 'react';
import {Panel, colors, Muted} from '../theme.js';
import type {Diagnostic} from '../../types.js';

interface Props {
    diagnostics: Diagnostic[];
    focused: boolean;
    maxRows: number;
    flexGrow?: number;
}

export function EventsPanel({diagnostics, focused, maxRows, flexGrow}: Props): React.ReactElement {

    // Reuse diagnostics as the "events" narrative for compose (no ECS event stream).
    const visible = diagnostics.slice(0, maxRows);

    return (
        <Panel title="5 · Issues" focused={focused} accentKind="warning" flexGrow={flexGrow}>
            {visible.length === 0 ? <Muted>(no issues)</Muted> : null}
            {visible.map((d) => (
                <Box key={d.id} flexDirection="column">
                    <Box>
                        <Text color={severityColor(d.severity)}>{d.severity.toUpperCase()}  </Text>
                        <Text color={colors.fg}>{truncate(d.title, 90)}</Text>
                    </Box>
                    <Text color={colors.muted}>  {truncate(d.detail, 100)}</Text>
                </Box>
            ))}
        </Panel>
    );

}

function severityColor(s: Diagnostic['severity']): string {

    switch (s) {

        case 'error': return colors.error;
        case 'warn': return colors.warning;
        default: return colors.info;

}

}

function truncate(s: string, n: number): string {

    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;

}
