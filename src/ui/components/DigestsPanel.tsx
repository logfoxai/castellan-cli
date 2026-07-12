import {Box, Text} from 'ink';
import React from 'react';
import {Panel, Pill, colors, Muted} from '../theme.js';
import type {ContainerSnapshot} from '../../types.js';

interface Props {
    containers: ContainerSnapshot[];
    focused: boolean;
    flexGrow?: number;
}

export function DigestsPanel({containers, focused, flexGrow}: Props): React.ReactElement {

    const watched = containers.filter((c) => c.watched);

    return (
        <Panel title="4 · Digests" focused={focused} accentKind="primary" flexGrow={flexGrow}>
            {watched.length === 0 ? <Muted>(no watched services)</Muted> : null}
            {watched.map((c) => (
                <Box flexDirection="column" key={c.name} marginBottom={0}>
                    <Box>
                        <Pill kind="primary">{c.service}</Pill>
                        <Text>  </Text>
                        <Text color={colors.fg}>{c.imageId || '—'}</Text>
                    </Box>
                    <Text color={colors.muted}>  {truncate(c.image, 70)}</Text>
                </Box>
            ))}
        </Panel>
    );

}

function truncate(s: string, n: number): string {

    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;

}
