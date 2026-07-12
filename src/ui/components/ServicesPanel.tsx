import {Box, Text} from 'ink';
import React from 'react';
import {Panel, Pill, colors, Muted} from '../theme.js';
import type {ContainerSnapshot} from '../../types.js';

interface Props {
    containers: ContainerSnapshot[];
    focused: boolean;
    flexGrow?: number;
}

export function ServicesPanel({containers, focused, flexGrow}: Props): React.ReactElement {

    return (
        <Panel title="3 · Services" focused={focused} accentKind="accent" flexGrow={flexGrow}>
            {containers.length === 0 ? <Muted>(no containers)</Muted> : null}
            {containers.map((c) => (
                <Box flexDirection="column" key={c.name}>
                    <Box>
                        {c.watched ? <Pill kind="primary">WATCH</Pill> : <Pill kind="muted">infra</Pill>}
                        <Text>  </Text>
                        <Text color={colors.fg} bold>{c.service}</Text>
                        <Text>  </Text>
                        <Text color={stateColor(c.state)}>{c.state}</Text>
                        <Text>  </Text>
                        <Text color={healthColor(c.health)}>
                            ● {c.health === 'none' ? '—' : c.health}
                        </Text>
                    </Box>
                    <Text color={colors.muted}>
                        {'  '}{c.imageId || '—'} · restarts {c.restartCount}
                        {c.startedAt ? ` · up ${relTime(c.startedAt)}` : ''}
                    </Text>
                </Box>
            ))}
        </Panel>
    );

}

function stateColor(state: string): string {

    switch (state) {

        case 'running': return colors.success;
        case 'restarting':
        case 'created': return colors.pending;
        case 'exited':
        case 'dead': return colors.error;
        default: return colors.muted;

}

}

function healthColor(health: string): string {

    switch (health) {

        case 'healthy': return colors.success;
        case 'unhealthy': return colors.error;
        case 'starting': return colors.pending;
        default: return colors.dim;

}

}

function relTime(d: Date): string {

    const diff = Date.now() - d.getTime();
    const s = Math.round(diff / 1000);

    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${Math.round(s / 3600)}h`;
    return `${Math.round(s / 86400)}d`;

}
