import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {analyzeWithExpected} from '../../analyze/diagnostics.js';
import {rootCause} from '../../analyze/rootCause.js';
import {describeStack} from '../../docker/compose.js';
import type {
    CliContext,
    Diagnostic,
    RootCauseAnalysis,
    StackSnapshot,
} from '../../types.js';

export interface StackState {
    loading: boolean;
    error: string | null;
    hasInitialData: boolean;
    stack: StackSnapshot | null;
    diagnostics: Diagnostic[];
    rootCauseAnalysis: RootCauseAnalysis | null;
    rootCauseLoading: boolean;
    lastFetchedAt: Date | null;
    refresh: () => Promise<void>;
    refreshRootCause: () => Promise<void>;
}

interface Options {
    pollIntervalMs?: number;
}

export function useStackState(ctx: CliContext, opts: Options = {}): StackState {

    const intervalMs = opts.pollIntervalMs ?? 5_000;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasInitialData, setHasInitialData] = useState(false);
    const [stack, setStack] = useState<StackSnapshot | null>(null);
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [rootCauseAnalysis, setRootCauseAnalysis] = useState<RootCauseAnalysis | null>(null);
    const [rootCauseLoading, setRootCauseLoading] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

    const mounted = useRef(true);
    const inFlight = useRef(false);

    const refresh = useCallback(async () => {

        if (inFlight.current) return;
        inFlight.current = true;
        try {

            const next = await describeStack(ctx);

            if (!mounted.current) return;
            setStack(next);
            setError(null);
            setHasInitialData(true);
            setLastFetchedAt(new Date());
            setDiagnostics(analyzeWithExpected(next, ctx.watchedServices));

} catch (err) {

            if (!mounted.current) return;
            setError(err instanceof Error ? err.message : String(err));

} finally {

            inFlight.current = false;
            if (mounted.current) setLoading(false);

}

}, [ctx]);

    const refreshRootCause = useCallback(async () => {

        if (!stack) return;
        setRootCauseLoading(true);
        try {

            const analysis = rootCause({stack, diagnostics});

            if (mounted.current) setRootCauseAnalysis(analysis);

} finally {

            if (mounted.current) setRootCauseLoading(false);

}

}, [stack, diagnostics]);

    useEffect(() => {

        mounted.current = true;
        void refresh();
        const id = setInterval(() => {

            void refresh();

}, intervalMs);

        return () => {

            mounted.current = false;
            clearInterval(id);

};

}, [refresh, intervalMs]);

    return useMemo<StackState>(() => ({
        loading,
        error,
        hasInitialData,
        stack,
        diagnostics,
        rootCauseAnalysis,
        rootCauseLoading,
        lastFetchedAt,
        refresh,
        refreshRootCause,
    }), [
        loading, error, hasInitialData, stack, diagnostics,
        rootCauseAnalysis, rootCauseLoading, lastFetchedAt, refresh, refreshRootCause,
    ]);

}
