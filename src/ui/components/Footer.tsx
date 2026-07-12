import {Box, Text, useStdout} from 'ink';
import React from 'react';
import {colors} from '../theme.js';
import {AD_URL, AD_TEXT, osc8} from '../../ad.js';

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
const AD_GAP = 4;

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
    const fitsFullAndAd = avail >= keysWidth + AD_TEXT.length + AD_GAP;

    if (fitsFull) {

        return (
            <Box paddingX={1} width="100%" justifyContent="space-between">
                <Box>
                    {KEYS.map((k, i) => (
                        <Box key={k.keys}>
                            <KeyHint k={k} />
                            {i < KEYS.length - 1 ? <Text color={colors.dim}>{SEP}</Text> : null}
                        </Box>
                    ))}
                </Box>
                {fitsFullAndAd ? <Text color={colors.dim}>{osc8(AD_URL, AD_TEXT)}</Text> : null}
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
