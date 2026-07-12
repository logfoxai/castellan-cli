import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import React from 'react';
import {Panel, Pill, colors, Muted} from '../theme.js';
import type {Diagnostic, RootCauseAnalysis} from '../../types.js';

interface Props {
    diagnostics: Diagnostic[];
    analysis: RootCauseAnalysis | null;
    analyzing: boolean;
    focused: boolean;
    flexGrow?: number;
}

export function DiagnosticsPanel({
    diagnostics, analysis, analyzing, focused, flexGrow,
}: Props): React.ReactElement {

    return (
        <Panel title="1 · Diagnostics" focused={focused} accentKind="error" flexGrow={flexGrow}>
            {diagnostics.length === 0
                ? <Box><Text color={colors.success}>● </Text><Text color={colors.fg}>no issues detected</Text></Box>
                : diagnostics.map((d) => (
                    <Box flexDirection="column" key={d.id}>
                        <Box>
                            <Pill kind={d.severity === 'error' ? 'error' : d.severity === 'warn' ? 'warning' : 'info'}>
                                {d.severity.toUpperCase()}
                            </Pill>
                            <Text>  </Text>
                            <Text color={colors.fg} bold>{d.title}</Text>
                        </Box>
                        <Text color={colors.muted}>  {truncate(d.detail, 140)}</Text>
                        {d.suggestion
                            ? <Text color={colors.info}>  → {truncate(d.suggestion, 140)}</Text>
                            : null}
                    </Box>
                ))}
            <Box marginTop={1} flexDirection="column">
                <Box>
                    <Text color={colors.accent} bold>Root cause</Text>
                    <Text>  </Text>
                    {analysis
                        ? <Pill kind="warning">HEURISTIC</Pill>
                        : <Pill kind="muted">press a to analyze</Pill>}
                    {analysis ? <Muted>  {analysis.elapsedMs}ms</Muted> : null}
                </Box>
                {analyzing
                    ? <Box><Text color={colors.primary}><Spinner type="dots" /></Text><Muted> thinking…</Muted></Box>
                    : null}
                {analysis
                    ? <Box flexDirection="column">
                        <Text color={colors.fg}>{analysis.summary}</Text>
                        {analysis.likelyCauses.length > 0
                            ? <Box flexDirection="column" marginTop={1}>
                                <Text color={colors.warning} bold>Causes</Text>
                                {analysis.likelyCauses.map((cause, i) => (
                                    <Text key={i} color={colors.fg}>  • {truncate(cause, 130)}</Text>
                                ))}
                            </Box>
                            : null}
                        {analysis.suggestedFixes.length > 0
                            ? <Box flexDirection="column" marginTop={1}>
                                <Text color={colors.success} bold>Fixes</Text>
                                {analysis.suggestedFixes.map((fix, i) => (
                                    <Text key={i} color={colors.fg}>  • {truncate(fix, 130)}</Text>
                                ))}
                            </Box>
                            : null}
                    </Box>
                    : null}
            </Box>
        </Panel>
    );

}

function truncate(s: string, n: number): string {

    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;

}
