// Docker Compose client over SSH. Talks to the remote host's docker CLI —
// no Dockerode, no daemon socket mount from the laptop.

import type {CliContext, ContainerSnapshot, ContainerState, HealthStatus, StackSnapshot} from '../types.js';
import {shellQuote, sshExec} from './ssh.js';

interface ComposePsRow {
    ID?: string;
    Name?: string;
    Service?: string;
    State?: string;
    Health?: string;
    ExitCode?: number;
    Publishers?: unknown;
    Image?: string;
    Status?: string;
    Project?: string;
}

interface InspectRow {
    Id?: string;
    Image?: string;
    Name?: string;
    Created?: string;
    RestartCount?: number;
    State?: {
        Status?: string;
        Running?: boolean;
        ExitCode?: number;
        StartedAt?: string;
        FinishedAt?: string;
        Health?: {Status?: string};
    };
    Config?: {Image?: string};
}

function composePrefix(ctx: CliContext): string {

    const parts = [`cd ${shellQuote(ctx.dir)}`];

    if (ctx.envFile) {

        parts.push(`docker compose --env-file ${shellQuote(ctx.envFile)} -f ${shellQuote(ctx.composeFile)}`);

} else {

        parts.push(`docker compose -f ${shellQuote(ctx.composeFile)}`);

}
    // Join with `&&` so cd failure aborts.
    return `${parts[0]} && ${parts[1]}`;

}

function parseJsonLines<T>(raw: string): T[] {

    const out: T[] = [];

    for (const line of raw.split('\n')) {

        const trimmed = line.trim();

        if (!trimmed) continue;
        try {

            out.push(JSON.parse(trimmed) as T);

} catch {

            // Some older compose versions wrap as a JSON array — try once.
            try {

                const parsed = JSON.parse(trimmed) as unknown;

                if (Array.isArray(parsed)) return parsed as T[];

} catch {
                // skip bad line
            }

}

}
    return out;

}

function normalizeState(raw: string | undefined): ContainerState {

    const s = (raw ?? '').toLowerCase();

    if (s === 'running' || s === 'exited' || s === 'restarting' || s === 'created' || s === 'paused' || s === 'dead') {

        return s;

}
    return 'unknown';

}

function normalizeHealth(raw: string | undefined): HealthStatus {

    const s = (raw ?? '').toLowerCase();

    if (s === 'healthy' || s === 'unhealthy' || s === 'starting') return s;
    if (!s || s === '' || s === 'none') return 'none';
    return 'unknown';

}

function parseDate(raw: string | undefined | null): Date | null {

    if (!raw || raw.startsWith('0001-')) return null;
    const d = new Date(raw);

    return Number.isNaN(d.getTime()) ? null : d;

}

function shortId(id: string): string {

    return id.replace(/^sha256:/, '').slice(0, 12);

}

export async function describeStack(ctx: CliContext): Promise<StackSnapshot> {

    const prefix = composePrefix(ctx);
    const ps = await sshExec(ctx.ssh, `${prefix} ps -a --format json`);
    const rows = parseJsonLines<ComposePsRow>(ps.stdout);

    if (rows.length === 0) {

        // Empty stack is valid (nothing up yet) — return empty snapshot.
        return {
            env: ctx.env,
            ssh: ctx.ssh,
            dir: ctx.dir,
            project: 'logfox',
            containers: [],
            fetchedAt: new Date(),
        };

}

    const names = rows.map((r) => r.Name).filter((n): n is string => Boolean(n));
    const inspectByName = new Map<string, InspectRow>();

    if (names.length > 0) {

        const inspectCmd = `docker inspect ${names.map(shellQuote).join(' ')}`;
        const inspected = await sshExec(ctx.ssh, inspectCmd);
        const parsed = JSON.parse(inspected.stdout) as InspectRow[];

        for (const row of parsed) {

            const name = (row.Name ?? '').replace(/^\//, '');

            if (name) inspectByName.set(name, row);

}

}

    const watched = new Set(ctx.watchedServices);
    const containers: ContainerSnapshot[] = rows.map((row) => {

        const name = row.Name ?? '';
        const insp = inspectByName.get(name);
        const service = row.Service ?? name;
        const imageId = insp?.Image ? shortId(insp.Image) : '';
        const healthFromInspect = insp?.State?.Health?.Status;
        const health = normalizeHealth(healthFromInspect ?? row.Health);
        const state = normalizeState(insp?.State?.Status ?? row.State);
        const exitCode = insp?.State?.ExitCode ?? row.ExitCode ?? null;

        return {
            service,
            name,
            id: shortId(row.ID ?? insp?.Id ?? ''),
            state,
            health,
            image: row.Image ?? insp?.Config?.Image ?? '',
            imageId,
            status: row.Status ?? '',
            exitCode: state === 'running' ? null : exitCode,
            startedAt: parseDate(insp?.State?.StartedAt),
            createdAt: parseDate(insp?.Created),
            restartCount: insp?.RestartCount ?? 0,
            watched: watched.has(service),
        };

});

    containers.sort((a, b) => a.service.localeCompare(b.service));

    const project = rows[0]?.Project ?? 'logfox';

    return {
        env: ctx.env,
        ssh: ctx.ssh,
        dir: ctx.dir,
        project,
        containers,
        fetchedAt: new Date(),
    };

}

/** Digests (image IDs) for watched services only. */
export function watchedDigests(stack: StackSnapshot): Record<string, string> {

    const out: Record<string, string> = {};

    for (const c of stack.containers) {

        if (!c.watched) continue;
        out[c.service] = c.imageId;

}
    return out;

}

export function watchedContainers(stack: StackSnapshot): ContainerSnapshot[] {

    return stack.containers.filter((c) => c.watched);

}
