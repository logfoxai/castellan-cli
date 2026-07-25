// Watch mode for Castellan rollouts:
//
//   1. Resolve services via Castellan /v1/status
//   2. Optionally POST /v1/forceCheck
//   3. Poll status + history; print new events and state changes
//   4. Exit 0 when watched services settle on a new digest; 1 on failure/timeout

import {CastellanClient} from '../castellan/client.js';
import {resolveServices} from '../castellan/resolve.js';
import type {DeploymentEvent, ServiceState, ServiceStatus} from '../castellan/types.js';
import * as gh from '../ghAnnotations.js';
import {c, colorEventType, colorServiceState, shortDigest} from '../theme.js';
import {
    evaluateRollout,
    initialWatchState,
    noteEvents,
    noteStatus,
    type RolloutWatchState,
} from './rollout.js';
import {
    EVENT_CELL_WIDTH,
    STATE_CELL_WIDTH,
    digestTransition,
    formatDuration,
    padVisible,
} from './watchFormat.js';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const TAG = c.accent('[castellan]');

export type WatchOptions = {
    client: CastellanClient;
    serviceQueries: string[];
    forceCheck: boolean;
    pollMs?: number;
    timeoutMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
};

export async function runWatch(opts: WatchOptions): Promise<number> {

    const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const now = opts.now ?? Date.now;
    const sleep = opts.sleep ?? defaultSleep;
    const startedAt = now();

    console.log(`${c.primary('==>')} Watching Castellan services: ${c.fg(opts.serviceQueries.join(', '))}`);

    let status;

    try {

        await opts.client.health();
        status = await opts.client.status();

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan-cli: Castellan unreachable'});
        console.error(c.error(msg));
        return 1;

    }

    if (status.paused) {

        console.log(`${TAG} ${c.warning('Castellan polling is paused — forceCheck / deploys may still run')}`);

    }

    let resolved;

    try {

        resolved = resolveServices(status.services, opts.serviceQueries);

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan-cli: ambiguous service'});
        console.error(c.error(msg));
        return 1;

    }

    if (resolved.missing.length > 0) {

        const known = status.services.map((service) => service.name).sort().join(', ') || '(none)';
        const msg = `Unknown Castellan service(s): ${resolved.missing.join(', ')}. Known: ${known}`;

        gh.error(msg, {title: 'castellan-cli: service not found'});
        console.error(c.error(msg));
        return 1;

    }

    const watched = resolved.resolved;
    const watchedNames = new Set(watched.map((service) => service.name));
    const nameWidth = watched.reduce((max, service) => Math.max(max, service.name.length), 1);
    const nameCell = (name: string): string => padVisible(c.fg(name), name.length, nameWidth);
    const stateCell = (state: ServiceState): string =>
        padVisible(colorServiceState(state), state.length + 2, STATE_CELL_WIDTH);

    for (const service of watched) {

        console.log(
            `${TAG} ${nameCell(service.name)} ${stateCell(service.state)} `
            + `${c.muted(`${service.repository}:${service.tag}`)} `
            + `${c.dim(shortDigest(service.currentDigest))}`,
        );

    }

    let watch: RolloutWatchState = initialWatchState(watched);
    const seenEventKeys = new Set<string>();
    let historySeeded = false;
    const lastStates = Object.fromEntries(watched.map((service) => [service.name, service.state]));

    // Seed seen events so we only stream fresh ones after watch start.
    try {

        const history = await opts.client.history();

        for (const event of history.events) {

            seenEventKeys.add(eventKey(event));

        }

        historySeeded = true;

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        console.error(`${TAG} ${c.warning(`history seed failed: ${msg} — will seed on next successful poll`)}`);

    }

    if (opts.forceCheck) {

        console.log(`${TAG} ${c.muted('POST /v1/forceCheck')}`);

        try {

            await opts.client.forceCheck();
            console.log(`${TAG} ${c.success('forceCheck accepted')}`);

        } catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            gh.error(msg, {title: 'castellan-cli: forceCheck failed'});
            console.error(c.error(msg));
            return 1;

        }

    } else {

        console.log(`${TAG} ${c.muted('watching only (--no-force-check)')}`);

    }

    const onSigint = (): void => {

        process.exit(130);

    };

    process.on('SIGINT', onSigint);

    while (true) {

        if (now() - startedAt > timeoutMs) {

            const msg = `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for Castellan rollout`;

            gh.error(msg, {title: 'castellan-cli: timeout'});
            console.error(c.error(msg));
            return 1;

        }

        let services: ServiceStatus[];
        let events: DeploymentEvent[] = [];

        try {

            const [statusResp, historyResp] = await Promise.all([
                opts.client.status(),
                opts.client.history(),
            ]);

            services = statusResp.services.filter((service) => watchedNames.has(service.name));
            events = historyResp.events;

        } catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            console.error(`${TAG} ${c.warning(`poll failed: ${msg}`)}`);
            await sleep(pollMs);
            continue;

        }

        // If the initial history seed failed, ignore only pre-watch events.
        // Events that landed during the gap (e.g. forceCheck deploy/failure)
        // stay unseen so noteEvents can apply them.
        if (!historySeeded) {

            seedRecoveredHistory(events, startedAt, seenEventKeys);
            historySeeded = true;
            console.log(`${TAG} ${c.muted('seeded history after poll recovery (pre-watch events ignored)')}`);

        }

        const fresh = events
            .filter((event) => watchedNames.has(event.service) && !seenEventKeys.has(eventKey(event)))
            .sort((a, b) => a.at.localeCompare(b.at));

        for (const event of fresh) {

            seenEventKeys.add(eventKey(event));
            console.log(
                `  ${TAG} `
                + `${padVisible(colorEventType(event.type), event.type.length + 2, EVENT_CELL_WIDTH)} `
                + `${nameCell(event.service)} ${colorEventMessage(event)}`,
            );

        }

        watch = noteEvents(watch, fresh, watchedNames);
        watch = noteStatus(watch, services);

        for (const service of services) {

            const prev = lastStates[service.name];

            if (prev !== service.state) {

                console.log(
                    `${TAG} ${nameCell(service.name)} ${stateCell(service.state)} `
                    + `${c.dim(digestTransition(service.currentDigest, service.desiredDigest))}`,
                );
                lastStates[service.name] = service.state;

            }

        }

        const outcome = evaluateRollout(watch, services);

        if (outcome.kind === 'success') {

            const elapsed = formatDuration(now() - startedAt);

            console.log(`${c.success('==>')} Rollout settled healthy ${c.dim(`in ${elapsed}`)}`);

            for (const service of services) {

                const baseline = watch.services[service.name]?.baselineDigest ?? null;

                console.log(
                    `    ${nameCell(service.name)} `
                    + `${c.dim(digestTransition(baseline, service.currentDigest))}`,
                );

            }

            gh.notice(`Castellan rollout settled healthy in ${elapsed}`, {title: 'castellan-cli'});
            process.off('SIGINT', onSigint);
            return 0;

        }

        if (outcome.kind === 'failure') {

            const elapsed = formatDuration(now() - startedAt);

            gh.error(outcome.reason, {title: 'castellan-cli: rollout failed'});
            console.error(`${c.error('==>')} ${outcome.reason} ${c.dim(`(after ${elapsed})`)}`);
            process.off('SIGINT', onSigint);
            return 1;

        }

        await sleep(pollMs);

    }

}

export function eventKey(event: DeploymentEvent): string {

    return `${event.at}|${event.type}|${event.service}|${event.message}`;

}

/** Mark only events older than watch start as seen (recovery after a failed seed). */
export function seedRecoveredHistory(
    events: DeploymentEvent[],
    watchStartedAtMs: number,
    seenEventKeys: Set<string>,
): void {

    const startedAtIso = new Date(watchStartedAtMs).toISOString();

    for (const event of events) {

        if (event.at < startedAtIso) {

            seenEventKeys.add(eventKey(event));

        }

    }

}

function colorEventMessage(event: DeploymentEvent): string {

    if (event.type === 'failure' || event.type === 'rollback') {

        return c.warning(event.message);

    }

    return c.muted(event.message);

}

function defaultSleep(ms: number): Promise<void> {

    return new Promise((resolve) => {

        setTimeout(resolve, ms);

    });

}
