import type {DeploymentEvent, ServiceState, ServiceStatus} from '../castellan/types.js';

export type RolloutOutcome =
    | {kind: 'pending'}
    | {kind: 'success'}
    | {kind: 'failure'; reason: string};

export type ServiceWatch = {
    name: string;
    baselineDigest: string | null;
    sawDeployActivity: boolean;
    sawRollback: boolean;
    sawFailureEvent: boolean;
};

export type RolloutWatchState = {
    services: Record<string, ServiceWatch>;
};

const ACTIVE_STATES: ReadonlySet<ServiceState> = new Set([
    'checking',
    'updating',
    'verifying',
    'rollback',
]);

export function initialWatchState(services: ServiceStatus[]): RolloutWatchState {

    const map: Record<string, ServiceWatch> = {};

    for (const service of services) {

        map[service.name] = {
            name: service.name,
            baselineDigest: service.currentDigest,
            sawDeployActivity: false,
            sawRollback: false,
            sawFailureEvent: false,
        };

    }

    return {services: map};

}

export function noteEvents(
    state: RolloutWatchState,
    events: DeploymentEvent[],
    watchedNames: Set<string>,
): RolloutWatchState {

    const next = cloneState(state);

    for (const event of events) {

        if (!watchedNames.has(event.service)) continue;

        const watch = next.services[event.service];

        if (!watch) continue;

        if (event.type === 'deploy' || event.type === 'check') {

            watch.sawDeployActivity = true;

        }

        if (event.type === 'rollback') {

            watch.sawRollback = true;
            watch.sawDeployActivity = true;

        }

        if (event.type === 'failure') {

            watch.sawFailureEvent = true;
            watch.sawDeployActivity = true;

        }

    }

    return next;

}

export function noteStatus(state: RolloutWatchState, services: ServiceStatus[]): RolloutWatchState {

    const next = cloneState(state);

    for (const service of services) {

        const watch = next.services[service.name];

        if (!watch) continue;

        if (ACTIVE_STATES.has(service.state)) {

            watch.sawDeployActivity = true;

        }

        if (service.state === 'rollback') {

            watch.sawRollback = true;

        }

        if (
            watch.baselineDigest !== null
            && service.currentDigest !== null
            && service.currentDigest !== watch.baselineDigest
        ) {

            watch.sawDeployActivity = true;

        }

    }

    return next;

}

export function evaluateRollout(
    state: RolloutWatchState,
    services: ServiceStatus[],
): RolloutOutcome {

    const byName = new Map(services.map((service) => [service.name, service]));

    for (const watch of Object.values(state.services)) {

        const service = byName.get(watch.name);

        if (!service) {

            return {kind: 'failure', reason: `Castellan no longer reports service ${watch.name}`};

        }

        if (service.state === 'failed' || watch.sawFailureEvent) {

            const detail = service.lastError ?? 'Castellan reported failure';

            return {kind: 'failure', reason: `${watch.name}: ${detail}`};

        }

        if (ACTIVE_STATES.has(service.state)) {

            return {kind: 'pending'};

        }

    }

    for (const watch of Object.values(state.services)) {

        const service = byName.get(watch.name);

        if (!service) continue;

        if (service.state !== 'stable' && service.state !== 'idle') {

            return {kind: 'pending'};

        }

        if (!watch.sawDeployActivity) {

            return {kind: 'pending'};

        }

        const digestAdvanced =
            watch.baselineDigest !== null
            && service.currentDigest !== null
            && service.currentDigest !== watch.baselineDigest;

        if (watch.sawRollback && !digestAdvanced) {

            return {
                kind: 'failure',
                reason: `${watch.name}: rolled back to previous digest`,
            };

        }

        if (!digestAdvanced) {

            // Checked registry but no new digest landed (or still on baseline).
            // Treat as pending until timeout — caller decides.
            return {kind: 'pending'};

        }

        if (
            service.desiredDigest !== null
            && service.currentDigest !== null
            && service.desiredDigest !== service.currentDigest
        ) {

            return {kind: 'pending'};

        }

    }

    return {kind: 'success'};

}

function cloneState(state: RolloutWatchState): RolloutWatchState {

    const services: Record<string, ServiceWatch> = {};

    for (const [name, watch] of Object.entries(state.services)) {

        services[name] = {...watch};

    }

    return {services};

}
