import {Box, Text} from 'ink';
import React from 'react';
import {Pill, Muted, colors} from '../theme.js';
import type {CliContext, StackSnapshot} from '../../types.js';
import {stackHealthy} from '../../modes/rollout.js';

interface Props {
    ctx: CliContext;
    stack: StackSnapshot | null;
    lastFetchedAt: Date | null;
    error: string | null;
}

export function HeaderBar({ctx, stack, lastFetchedAt, error}: Props): React.ReactElement {

    if (!stack) {

        return (
            <Box paddingX={1}>
                <Pill kind="primary"> composewatch </Pill>
                <Text>  </Text>
                <Muted>{error ? `error: ${error}` : 'loading…'}</Muted>
            </Box>
        );

}
    const watched = stack.containers.filter((c) => c.watched);
    const ok = watched.filter((c) => c.state === 'running' && c.health !== 'unhealthy').length;
    const ageMs = lastFetchedAt ? Date.now() - lastFetchedAt.getTime() : 0;
    const healthy = stackHealthy(stack);

    return (
        <Box paddingX={1} flexDirection="row" justifyContent="space-between">
            <Box>
                <Pill kind="primary"> composewatch </Pill>
                <Text>  </Text>
                <Text color={colors.accent} bold>{ctx.env}</Text>
                <Text color={colors.muted}>  via  </Text>
                <Text color={colors.fg}>{ctx.ssh}</Text>
            </Box>
            <Box>
                <Pill kind={healthy ? 'success' : 'warning'}>{healthy ? 'HEALTHY' : 'DEGRADED'}</Pill>
                <Text>  </Text>
                <Muted>watched </Muted>
                <Text color={colors.success} bold>{ok}</Text>
                <Text color={colors.muted}>/</Text>
                <Text color={colors.fg} bold>{watched.length}</Text>
                <Text>  </Text>
                <Muted>total </Muted>
                <Text color={colors.fg} bold>{stack.containers.length}</Text>
                <Text>  </Text>
                <Muted>↻ {Math.max(0, Math.round(ageMs / 1000))}s</Muted>
            </Box>
        </Box>
    );

}
