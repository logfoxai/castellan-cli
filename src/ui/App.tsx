import {Box, useApp, useInput, useStdout} from 'ink';
import React, {useEffect, useRef, useState} from 'react';

import type {CliContext} from '../types.js';

import {HeaderBar} from './components/HeaderBar.js';
import {DiagnosticsPanel} from './components/DiagnosticsPanel.js';
import {HealthPanel} from './components/HealthPanel.js';
import {ServicesPanel} from './components/ServicesPanel.js';
import {DigestsPanel} from './components/DigestsPanel.js';
import {EventsPanel} from './components/EventsPanel.js';
import {LogsPanel} from './components/LogsPanel.js';
import {Footer} from './components/Footer.js';
import {Help} from './components/Help.js';

import {useStackState} from './hooks/useStackState.js';
import {useLogStream} from './hooks/useLogStream.js';

type Focus = 'diagnostics' | 'health' | 'services' | 'digests' | 'events' | 'logs';

const TOP_CHROME = 24;
const NARROW_TOP_CHROME = 34;
const NARROW_COLS = 100;

interface AppProps {
    ctx: CliContext;
}

export function App({ctx}: AppProps): React.ReactElement {

    const {exit} = useApp();
    const {stdout} = useStdout();
    const [focus, setFocus] = useState<Focus>('services');
    const [showHelp, setShowHelp] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [logsPaused, setLogsPaused] = useState(false);
    const [logScroll, setLogScroll] = useState(0);

    const state = useStackState(ctx, {pollIntervalMs: 5_000});
    const logs = useLogStream(ctx, logsPaused);

    const rows = stdout?.rows ?? 40;
    const cols = stdout?.columns ?? 80;
    const narrow = cols < NARROW_COLS;
    const bottomRows = narrow
        ? Math.max(4, Math.floor((rows - NARROW_TOP_CHROME) / 2))
        : Math.max(6, rows - TOP_CHROME);

    const prevLogLen = useRef(logs.lines.length);

    useEffect(() => {

        const delta = logs.lines.length - prevLogLen.current;

        prevLogLen.current = logs.lines.length;
        if (delta > 0 && logScroll > 0) {

            setLogScroll((s) => clampScroll(s + delta, logs.lines.length, bottomRows));

}

}, [logs.lines.length, logScroll, bottomRows]);

    useInput((input, key) => {

        if (key.ctrl && input === 'c') {

            exit(); return;

}
        if (input === 'q') {

            exit(); return;

}

        if (focus === 'logs') {

            if (key.upArrow) {

                setLogScroll((s) => clampScroll(s + 1, logs.lines.length, bottomRows)); return;

}
            if (key.downArrow) {

                setLogScroll((s) => Math.max(0, s - 1)); return;

}
            if (key.pageUp) {

                setLogScroll((s) => clampScroll(s + bottomRows, logs.lines.length, bottomRows)); return;

}
            if (key.pageDown) {

                setLogScroll((s) => Math.max(0, s - bottomRows)); return;

}
            if (key.escape) {

                setLogScroll(0); return;

}
            if (input === 'g') {

                setLogScroll(maxScroll(logs.lines.length, bottomRows)); return;

}
            if (input === 'G') {

                setLogScroll(0); return;

}

}

        if (input === 'r') {

            void state.refresh(); return;

}
        if (input === '?') {

            setShowHelp((v) => !v); return;

}
        if (input === 'm') {

            setShowMenu((v) => !v); return;

}
        if (input === 'p') {

            setLogsPaused((v) => !v); return;

}
        if (input === 'a') {

            void state.refreshRootCause(); return;

}
        if (input === '1') {

            setFocus('diagnostics'); return;

}
        if (input === '2') {

            setFocus('health'); return;

}
        if (input === '3') {

            setFocus('services'); return;

}
        if (input === '4') {

            setFocus('digests'); return;

}
        if (input === '5') {

            setFocus('events'); return;

}
        if (input === '6') {

            setFocus('logs'); return;

}

});

    // Auto-analyze on first error diagnostic.
    const errorId = state.diagnostics.find((d) => d.severity === 'error')?.id;

    useEffect(() => {

        if (!errorId) return;
        if (state.rootCauseAnalysis) return;
        if (state.rootCauseLoading) return;
        void state.refreshRootCause();

}, [errorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const shortGrow = narrow ? undefined : 1;
    const containers = state.stack?.containers ?? [];
    const diagnostics = (
        <DiagnosticsPanel
            diagnostics={state.diagnostics}
            analysis={state.rootCauseAnalysis}
            analyzing={state.rootCauseLoading}
            focused={focus === 'diagnostics'}
            flexGrow={shortGrow}
        />
    );
    const health = (
        <HealthPanel containers={containers} focused={focus === 'health'} flexGrow={shortGrow} />
    );
    const services = (
        <ServicesPanel containers={containers} focused={focus === 'services'} flexGrow={shortGrow} />
    );
    const digests = (
        <DigestsPanel containers={containers} focused={focus === 'digests'} flexGrow={shortGrow} />
    );
    const events = (
        <EventsPanel
            diagnostics={state.diagnostics}
            focused={focus === 'events'}
            maxRows={bottomRows}
            flexGrow={1}
        />
    );
    const logsPanel = (
        <LogsPanel
            lines={logs.lines}
            focused={focus === 'logs'}
            maxRows={bottomRows}
            scroll={logScroll}
            started={logs.started}
            error={logs.error}
            flexGrow={1}
        />
    );

    return (
        <Box flexDirection="column" height={rows}>
            <HeaderBar ctx={ctx} stack={state.stack} lastFetchedAt={state.lastFetchedAt} error={state.error} />
            {showHelp ? <Help /> : null}

            {narrow ? (
                <Box flexDirection="column" flexGrow={1}>
                    {diagnostics}
                    {health}
                    {services}
                    {digests}
                    {events}
                    {logsPanel}
                </Box>
            ) : (
                <>
                    <Box flexDirection="row">
                        <GridCell>{diagnostics}</GridCell>
                        <GridCell>{health}</GridCell>
                    </Box>
                    <Box flexDirection="row">
                        <GridCell>{services}</GridCell>
                        <GridCell>{digests}</GridCell>
                    </Box>
                    <Box flexDirection="row" flexGrow={1}>
                        <GridCell>{events}</GridCell>
                        <GridCell>{logsPanel}</GridCell>
                    </Box>
                </>
            )}

            <Footer showMenu={showMenu} />
        </Box>
    );

}

function GridCell({children}: {children: React.ReactNode}): React.ReactElement {

    return (
        <Box flexBasis={0} flexGrow={1} flexDirection="column" overflow="hidden">
            {children}
        </Box>
    );

}

function maxScroll(total: number, viewport: number): number {

    return Math.max(0, total - viewport);

}

function clampScroll(value: number, total: number, viewport: number): number {

    return Math.min(Math.max(0, value), maxScroll(total, viewport));

}
