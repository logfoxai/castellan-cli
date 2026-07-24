import {Box, Text, useStdout} from 'ink';
import React from 'react';
import {colors} from '../theme.js';

interface Key {
    keys: string;
    label: string;
}

const KEYS: Key[] = [
    {keys: '1-6', label: 'panel'},
    {keys: 'r', label: 'refresh'},
    {keys: 'a', label: 'analyze'},
    {keys: 'p', label: 'pause logs'},
    {keys: '?', label: 'help'},
    {keys: 'q', label: 'quit'},
];

const SEP = ' · ';

interface Props {
    showMenu: boolean;
}

function KeyHint({k}: {k: Key}): React.ReactElement {

    return (
        <Text>
            <Text color={colors.primary} bold>{k.keys}</Text>
            <Text color={colors.muted}> {k.label}</Text>
        </Text>
    );

}

export function Footer({showMenu}: Props): React.ReactElement {

    const {stdout} = useStdout();
    const cols = stdout?.columns ?? 80;
    const keysWidth = KEYS.map((k) => `${k.keys} ${k.label}`).join(SEP).length;
    const avail = cols - 2;
    const fitsFull = avail >= keysWidth;

    if (fitsFull) {

        return (
            <Box paddingX={1} width="100%">
                {KEYS.map((k, i) => (
                    <Box key={k.keys}>
                        <KeyHint k={k} />
                        {i < KEYS.length - 1 ? <Text color={colors.dim}>{SEP}</Text> : null}
                    </Box>
                ))}
            </Box>
        );

}

    if (showMenu) {

        return (
            <Box paddingX={1} flexWrap="wrap">
                {KEYS.map((k, i) => (
                    <Box key={k.keys}>
                        <KeyHint k={k} />
                        {i < KEYS.length - 1 ? <Text color={colors.dim}>{SEP}</Text> : null}
                    </Box>
                ))}
            </Box>
        );

}

    return (
        <Box paddingX={1}>
            <KeyHint k={{keys: 'm', label: 'menu'}} />
            <Text color={colors.dim}>{SEP}</Text>
            <KeyHint k={{keys: 'q', label: 'quit'}} />
        </Box>
    );

}
