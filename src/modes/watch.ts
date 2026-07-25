// Watch mode for Castellan rollouts:
//
//   1. Resolve services via Castellan /v1/status
//   2. Optionally ask Castellan to check registries
//   3. Poll status + history; print friendly progress
//   4. Exit 0 when watched services settle on a new digest; 1 on failure/timeout

import {CastellanClient} from '../castellan/client.js';
import {resolveServices} from '../castellan/resolve.js';
import type {DeploymentEvent, ServiceStatus} from '../castellan/types.js';
import * as gh from '../ghAnnotations.js';
import {c, colorServiceState, shortDigest} from '../theme.js';
import {
    evaluateRollout,
    initialWatchState,
    noteEvents,
    noteStatus,
    type RolloutWatchState,
} from './rollout.js';
import {
    digestTransition,
    eventEmoji,
    formatDuration,
    stateEmoji,
} from './watchFormat.js';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;

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

    console.log(`🔎 Watching ${c.fg(opts.serviceQueries.join(', '))}`);

    let status;

    try {

        await opts.client.health();
        status = await opts.client.status();

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan: Castellan unreachable'});
        console.error(`❌ ${c.error(msg)}`);
        return 1;

    }

    if (status.paused) {

        console.log(`⚠️  ${c.warning('Castellan polling is paused — updates may still run')}`);

    }

    let resolved;

    try {

        resolved = resolveServices(status.services, opts.serviceQueries);

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan: ambiguous service'});
        console.error(`❌ ${c.error(msg)}`);
        return 1;

    }

    if (resolved.missing.length > 0) {

        const known = status.services.map((service) => service.name).sort().join(', ') || '(none)';
        const msg = `Unknown service(s): ${resolved.missing.join(', ')}. Known: ${known}`;

        gh.error(msg, {title: 'castellan: service not found'});
        console.error(`❌ ${c.error(msg)}`);
        return 1;

    }

    const watched = resolved.resolved;
    const watchedNames = new Set(watched.map((service) => service.name));

    for (const service of watched) {

        console.log(
            `${stateEmoji(service.state)} ${c.fg(service.name)} `
            + `${colorServiceState(service.state)} `
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

        console.error(`⚠️  ${c.warning(`Couldn't load history yet: ${msg} — will retry`)}`);

    }

    if (opts.forceCheck) {

        console.log('🔄 Checking registry for updates…');

        try {

            await opts.client.forceCheck();
            console.log('✓ Check started — waiting for rollout');

        } catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            gh.error(msg, {title: 'castellan: check failed'});
            console.error(`❌ ${c.error(msg)}`);
            return 1;

        }

    } else {

        console.log(`👀 Watching for changes ${c.dim('(skipped registry check)')}`);

    }

    const onSigint = (): void => {

        process.exit(130);

    };

    process.on('SIGINT', onSigint);

    while (true) {

        if (now() - startedAt > timeoutMs) {

            const msg = `Timed out after ${formatDuration(timeoutMs)} waiting for rollout`;

            gh.error(msg, {title: 'castellan: timeout'});
            console.error(`❌ ${c.error(msg)}`);
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

            console.error(`⚠️  ${c.warning(`Lost connection: ${msg} — retrying…`)}`);
            await sleep(pollMs);
            continue;

        }

        // If the initial history seed failed, ignore only pre-watch events.
        // Events that landed during the gap (e.g. forceCheck deploy/failure)
        // stay unseen so noteEvents can apply them.
        if (!historySeeded) {

            seedRecoveredHistory(events, startedAt, seenEventKeys);
            historySeeded = true;

        }

        const fresh = events
            .filter((event) => watchedNames.has(event.service) && !seenEventKeys.has(eventKey(event)))
            .sort((a, b) => a.at.localeCompare(b.at));

        for (const event of fresh) {

            seenEventKeys.add(eventKey(event));
            console.log(
                `${eventEmoji(event.type)} ${c.fg(event.service)} ${colorEventMessage(event)}`,
            );

        }

        watch = noteEvents(watch, fresh, watchedNames);
        watch = noteStatus(watch, services);

        for (const service of services) {

            const prev = lastStates[service.name];

            if (prev !== service.state) {

                console.log(
                    `${stateEmoji(service.state)} ${c.fg(service.name)} `
                    + `${colorServiceState(service.state)} `
                    + `${c.dim(digestTransition(service.currentDigest, service.desiredDigest))}`,
                );
                lastStates[service.name] = service.state;

            }

        }

        const outcome = evaluateRollout(watch, services);

        if (outcome.kind === 'success') {

            const elapsed = formatDuration(now() - startedAt);

            console.log(`✅ Healthy in ${c.success(elapsed)}`);

            for (const service of services) {

                const baseline = watch.services[service.name]?.baselineDigest ?? null;

                console.log(
                    `${c.fg(service.name)} ${c.dim(digestTransition(baseline, service.currentDigest))}`,
                );

            }

            gh.notice(`Castellan rollout settled healthy in ${elapsed}`, {title: 'castellan'});
            process.off('SIGINT', onSigint);
            return 0;

        }

        if (outcome.kind === 'failure') {

            const elapsed = formatDuration(now() - startedAt);

            gh.error(outcome.reason, {title: 'castellan: rollout failed'});
            console.error(`❌ ${c.error(outcome.reason)} ${c.dim(`(after ${elapsed})`)}`);
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
