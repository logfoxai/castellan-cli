import {Box, Text} from 'ink';
import React from 'react';
import {Panel, colors, Muted} from '../theme.js';
import type {ContainerSnapshot} from '../../types.js';

interface Props {
    containers: ContainerSnapshot[];
    focused: boolean;
    flexGrow?: number;
}

export function HealthPanel({containers, focused, flexGrow}: Props): React.ReactElement {

    const watched = containers.filter((c) => c.watched);

    return (
        <Panel title="2 · Health" focused={focused} accentKind="success" flexGrow={flexGrow}>
            {watched.length === 0 ? <Muted>(no watched services)</Muted> : null}
            {watched.map((c) => (
                <Box key={c.name}>
                    <Text color={healthColor(c.health)}>● </Text>
                    <Text color={colors.fg} bold>{c.service}</Text>
                    <Text>  </Text>
                    <Text color={healthColor(c.health)}>{c.health === 'none' ? 'no-check' : c.health}</Text>
                    <Text>  </Text>
                    <Muted>{c.state}</Muted>
                </Box>
            ))}
        </Panel>
    );

}

function healthColor(health: string): string {

    if (health === 'healthy') return colors.success;
    if (health === 'unhealthy') return colors.error;
    if (health === 'starting') return colors.pending;
    return colors.dim;

}
