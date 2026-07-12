import {useEffect, useRef, useState} from 'react';

import {pollLogs} from '../../docker/logs.js';
import type {CliContext, LogLine} from '../../types.js';

const MAX_LINES = 1000;
const POLL_MS = 3_000;

export interface LogStreamState {
    lines: LogLine[];
    started: boolean;
    error: string | null;
}

export function useLogStream(ctx: CliContext, paused: boolean): LogStreamState {

    const [lines, setLines] = useState<LogLine[]>([]);
    const [started, setStarted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sinceRef = useRef<Date | null>(null);
    const seenRef = useRef(new Set<string>());
    const seededRef = useRef(false);

    useEffect(() => {

        if (paused) return;
        let cancelled = false;

        const tick = async (): Promise<void> => {

            try {

                const batch = await pollLogs(ctx, {
                    tail: seededRef.current ? 40 : 80,
                    services: ctx.watchedServices,
                    since: sinceRef.current ?? undefined,
                });

                if (cancelled) return;

                const fresh: LogLine[] = [];

                for (const line of batch) {

                    const key = `${line.stream}|${line.timestamp.toISOString()}|${line.message}`;

                    if (seenRef.current.has(key)) continue;
                    seenRef.current.add(key);
                    fresh.push(line);

}
                if (seenRef.current.size > MAX_LINES * 2) {

                    seenRef.current = new Set([...seenRef.current].slice(-MAX_LINES));

}

                if (fresh.length > 0) {

                    const newest = fresh[fresh.length - 1]!;

                    sinceRef.current = newest.timestamp;
                    setLines((prev) => {

                        const combined = prev.concat(fresh);

                        return combined.length > MAX_LINES
                            ? combined.slice(combined.length - MAX_LINES)
                            : combined;

});

}
                seededRef.current = true;
                setStarted(true);
                setError(null);

} catch (err) {

                if (!cancelled) {

                    setError(err instanceof Error ? err.message : String(err));
                    setStarted(true);

}

}

};

        void tick();
        const id = setInterval(() => {

            void tick();

}, POLL_MS);

        return () => {

            cancelled = true;
            clearInterval(id);

};

    // Re-bind when SSH target / watched set changes; not on every render of ctx object.

}, [ctx.env, ctx.ssh, ctx.dir, ctx.composeFile, ctx.envFile, paused, ctx.watchedServices.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    return {lines, started, error};

}
