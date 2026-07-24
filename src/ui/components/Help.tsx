import {Box, Text} from 'ink';
import React from 'react';
import {colors, Pill} from '../theme.js';

interface Row {
    keys: string;
    desc: string;
}

const ROWS: Row[] = [
    {keys: '1 / 2 / 3 / 4 / 5 / 6', desc: 'focus diagnostics · health · services · digests · issues · logs'},
    {keys: 'r', desc: 'manual refresh now (otherwise polls every 5s)'},
    {keys: 'a', desc: 'run heuristic root-cause analysis'},
    {keys: 'p', desc: 'pause / resume log polling'},
    {keys: '↑ / ↓', desc: 'when logs focused: scroll one line'},
    {keys: 'PgUp / PgDn', desc: 'when logs focused: scroll one page'},
    {keys: 'g / G', desc: 'when logs focused: oldest (g) / live tail (G)'},
    {keys: 'Esc', desc: 'when logs focused: jump back to live tail'},
    {keys: 'm', desc: 'toggle full keybind menu on narrow terminals'},
    {keys: '?', desc: 'toggle this help overlay'},
    {keys: 'q / ctrl-c', desc: 'quit'},
];

export function Help(): React.ReactElement {

    return (
        <Box flexDirection="column" borderStyle="double" borderColor={colors.primary} paddingX={2} paddingY={1}>
            <Box>
                <Pill kind="primary"> composewatch help </Pill>
                <Text color={colors.muted}>  · live Docker Compose inspection over SSH</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
                {ROWS.map((r) => (
                    <Box key={r.keys}>
                        <Box width={28}>
                            <Text color={colors.accent} bold>{r.keys}</Text>
                        </Box>
                        <Text color={colors.fg}>{r.desc}</Text>
                    </Box>
                ))}
            </Box>
            <Box marginTop={1}>
                <Text color={colors.muted}>
                    Tip: requires SSH reachability to the compose host (BatchMode=yes).
                </Text>
            </Box>
        </Box>
    );

}
