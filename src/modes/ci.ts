// CI/streaming mode for Castellan rollouts (ecswatch-shaped):
//
//   1. Resolve services via Castellan /v1/status
//   2. Optionally POST /v1/forceCheck
//   3. Poll status + history; print new events and state changes
//   4. Exit 0 when watched services settle on a new digest; 1 on failure/timeout

import {CastellanClient} from '../castellan/client.js';
import {resolveServices} from '../castellan/resolve.js';
import type {DeploymentEvent, ServiceStatus} from '../castellan/types.js';
import * as gh from '../ghAnnotations.js';
import {c, colorEventType, colorServiceState, shortDigest} from '../theme.js';
import {
    evaluateRollout,
    initialWatchState,
    noteEvents,
    noteStatus,
    type RolloutWatchState,
} from './rollout.js';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const TAG = c.accent('[castellan]');

export type CiOptions = {
    client: CastellanClient;
    serviceQueries: string[];
    forceCheck: boolean;
    pollMs?: number;
    timeoutMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
};

export async function runCi(opts: CiOptions): Promise<number> {

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

        gh.error(msg, {title: 'castwatch: Castellan unreachable'});
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

        gh.error(msg, {title: 'castwatch: ambiguous service'});
        console.error(c.error(msg));
        return 1;

    }

    if (resolved.missing.length > 0) {

        const known = status.services.map((service) => service.name).sort().join(', ') || '(none)';
        const msg = `Unknown Castellan service(s): ${resolved.missing.join(', ')}. Known: ${known}`;

        gh.error(msg, {title: 'castwatch: service not found'});
        console.error(c.error(msg));
        return 1;

    }

    const watched = resolved.resolved;
    const watchedNames = new Set(watched.map((service) => service.name));

    for (const service of watched) {

        console.log(
            `${TAG} ${c.fg(service.name)} ${colorServiceState(service.state)} `
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

            gh.error(msg, {title: 'castwatch: forceCheck failed'});
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

            gh.error(msg, {title: 'castwatch: timeout'});
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

        // If the initial history seed failed, mark everything currently in
        // history as seen without applying it — otherwise stale failure/rollback
        // events from prior deploys can false-fail this CI run.
        if (!historySeeded) {

            for (const event of events) {

                seenEventKeys.add(eventKey(event));

            }

            historySeeded = true;
            console.log(`${TAG} ${c.muted('seeded history after poll recovery (prior events ignored)')}`);

        }

        const fresh = events
            .filter((event) => watchedNames.has(event.service) && !seenEventKeys.has(eventKey(event)))
            .sort((a, b) => a.at.localeCompare(b.at));

        for (const event of fresh) {

            seenEventKeys.add(eventKey(event));
            console.log(
                `  ${TAG} ${colorEventType(event.type)} ${c.fg(event.service)} ${colorEventMessage(event)}`,
            );

        }

        watch = noteEvents(watch, fresh, watchedNames);
        watch = noteStatus(watch, services);

        for (const service of services) {

            const prev = lastStates[service.name];

            if (prev !== service.state) {

                console.log(
                    `${TAG} ${c.fg(service.name)} ${colorServiceState(service.state)} `
                    + `${c.dim(shortDigest(service.currentDigest))}${
                     service.desiredDigest && service.desiredDigest !== service.currentDigest
                        ? ` ${c.muted('→')} ${c.dim(shortDigest(service.desiredDigest))}`
                        : ''}`,
                );
                lastStates[service.name] = service.state;

            }

        }

        const outcome = evaluateRollout(watch, services);

        if (outcome.kind === 'success') {

            console.log(`${c.success('==>')} Rollout settled healthy`);
            gh.notice('Castellan rollout settled healthy', {title: 'castwatch'});
            process.off('SIGINT', onSigint);
            return 0;

        }

        if (outcome.kind === 'failure') {

            gh.error(outcome.reason, {title: 'castwatch: rollout failed'});
            console.error(`${c.error('==>')} ${outcome.reason}`);
            process.off('SIGINT', onSigint);
            return 1;

        }

        await sleep(pollMs);

    }

}

function eventKey(event: DeploymentEvent): string {

    return `${event.at}|${event.type}|${event.service}|${event.message}`;

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
